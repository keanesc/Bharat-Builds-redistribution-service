import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { db, listingsTable } from "../lib/db.js";
import { actorId, badRequest, internalError, json } from "../lib/http.js";
import { statusEvent } from "../domain/status.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const id = event.pathParameters?.id;
    if (!id) return badRequest("listing id is required");
    const actor = actorId(event);
    const now = new Date().toISOString();
    const result = await db.send(new UpdateCommand({
      TableName: listingsTable,
      Key: { id },
      UpdateExpression: "SET #status = :claimed, claimedBy = :actor, claimedAt = :now, statusHistory = list_append(if_not_exists(statusHistory, :empty), :history)",
      ConditionExpression: "attribute_exists(id) AND #status = :available AND pickupDeadline > :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":claimed": "CLAIMED",
        ":available": "AVAILABLE",
        ":actor": actor,
        ":now": now,
        ":empty": [],
        ":history": [statusEvent("AVAILABLE", "CLAIMED", actor, now)]
      },
      ReturnValues: "ALL_NEW"
    }));
    return json(200, result.Attributes);
  } catch (error) {
    if ((error as { name?: string }).name === "ConditionalCheckFailedException") {
      return json(409, { error: "CLAIM_CONFLICT", message: "Listing is already claimed, cancelled, or expired" });
    }
    if (error instanceof Error && error.message.includes("required")) return badRequest(error.message);
    return internalError(error);
  }
};
