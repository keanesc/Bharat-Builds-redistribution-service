import { randomUUID } from "node:crypto";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { GetCommand, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { CreateListingRequest, SurplusListing } from "@rescue-radius/shared";
import { DEMO_ACTOR_ROLES } from "@rescue-radius/shared";
import { haversineDistanceKm } from "../domain/distance.js";
import { db, listingsTable, statusIndex } from "../lib/db.js";
import { actorId, badRequest, internalError, json, parseBody } from "../lib/http.js";
import { statusEvent } from "../domain/status.js";

const VALID_CATEGORIES = ["VEG", "NON_VEG", "PACKAGED"];

function isExpired(listing: SurplusListing, now: string): boolean {
  return listing.pickupDeadline <= now;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const method = event.requestContext.http.method;
    const id = event.pathParameters?.id;

    if (method === "GET" && event.rawPath === "/listings/mine") {
      const requester = actorId(event);
      const role = DEMO_ACTOR_ROLES[requester];
      if (!role) return badRequest("X-Demo-Actor must be a known demo actor ID");
      if (role === "ADMIN") {
        return json(403, { error: "FORBIDDEN", message: "Admin actors do not have personal listings" });
      }

      const items: SurplusListing[] = [];
      let exclusiveStartKey: Record<string, any> | undefined;
      do {
        const result = await db.send(new ScanCommand({
          TableName: listingsTable,
          ExclusiveStartKey: exclusiveStartKey
        }));
        items.push(...((result.Items as SurplusListing[] | undefined) ?? []));
        exclusiveStartKey = result.LastEvaluatedKey;
      } while (exclusiveStartKey);

      const listings = items
        .filter((listing) => role === "RESTAURANT"
          ? listing.restaurantId === requester
          : listing.claimedBy === requester)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return json(200, { listings });
    }

    if (method === "GET" && id) {
      const result = await db.send(new GetCommand({ TableName: listingsTable, Key: { id } }));
      if (!result.Item) return json(404, { error: "NOT_FOUND", message: "Listing not found" });
      return json(200, result.Item);
    }

    if (method === "GET") {
      const query = event.queryStringParameters ?? {};
      const now = new Date().toISOString();
      const result = await db.send(new QueryCommand({
        TableName: listingsTable,
        IndexName: statusIndex,
        KeyConditionExpression: "#status = :available",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":available": "AVAILABLE" }
      }));

      const latitude = Number(query.latitude);
      const longitude = Number(query.longitude);
      const radiusKm = Number(query.radiusKm ?? 10);
      const hasOrigin = Number.isFinite(latitude) && Number.isFinite(longitude);
      const foodCategoryFilter = query.foodCategory as string | undefined;
      const minQuantity = query.minQuantity ? Number(query.minQuantity) : undefined;
      const maxMinutes = query.maxMinutesUntilDeadline ? Number(query.maxMinutesUntilDeadline) : undefined;
      const restaurantIdFilter = query.restaurantId as string | undefined;

      const listings = (result.Items as SurplusListing[] | undefined ?? [])
        .filter((listing) => !isExpired(listing, now))
        .filter((listing) => !hasOrigin || haversineDistanceKm(
          { latitude, longitude },
          { latitude: listing.latitude, longitude: listing.longitude }
        ) <= radiusKm)
        .filter((listing) => !foodCategoryFilter || listing.foodCategory === foodCategoryFilter)
        .filter((listing) => minQuantity === undefined || listing.quantityMeals >= minQuantity)
        .filter((listing) => maxMinutes === undefined || (new Date(listing.pickupDeadline).getTime() - Date.now()) / 60000 <= maxMinutes)
        .filter((listing) => !restaurantIdFilter || listing.restaurantId === restaurantIdFilter)
        .sort((a, b) => a.pickupDeadline.localeCompare(b.pickupDeadline));

      return json(200, { listings });
    }

    if (method === "POST" && !id) {
      const body = parseBody<CreateListingRequest>(event);
      const creator = actorId(event);

      if (!DEMO_ACTOR_ROLES[creator]) {
        return badRequest("X-Demo-Actor must be a known demo actor ID");
      }
      if (!body.restaurantId || !body.restaurantName || !body.foodDescription || body.quantityMeals <= 0) {
        return badRequest("restaurantId, restaurantName, foodDescription, and positive quantityMeals are required");
      }
      if (!Number.isFinite(body.latitude) || !Number.isFinite(body.longitude)) {
        return badRequest("latitude and longitude must be valid numbers");
      }
      if (!body.foodCategory || !VALID_CATEGORIES.includes(body.foodCategory)) {
        return badRequest("foodCategory must be VEG, NON_VEG, or PACKAGED");
      }
      if (!body.packedAt || isNaN(new Date(body.packedAt).getTime())) {
        return badRequest("packedAt must be a valid ISO timestamp");
      }
      if (new Date(body.pickupDeadline).getTime() <= Date.now()) {
        return badRequest("pickupDeadline must be in the future");
      }

      const now = new Date().toISOString();
      const listing: SurplusListing = {
        ...body,
        id: randomUUID(),
        status: "AVAILABLE",
        createdAt: now,
        statusHistory: [statusEvent(null, "AVAILABLE", creator, now)]
      };
      await db.send(new PutCommand({ TableName: listingsTable, Item: listing }));
      return json(201, listing);
    }

    return json(405, { error: "METHOD_NOT_ALLOWED", message: "Unsupported listings operation" });
  } catch (error) {
    if (error instanceof Error && error.message.includes("required")) return badRequest(error.message);
    return internalError(error);
  }
};
