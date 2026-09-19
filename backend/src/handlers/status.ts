import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { ListingStatus } from "@rescue-radius/shared";
import { canTransition, statusEvent } from "../domain/status.js";
import { db, listingsTable } from "../lib/db.js";
import { actorId, badRequest, internalError, json } from "../lib/http.js";

const actionMap: Record<string, { from: ListingStatus; to: ListingStatus }> = {
  cancel: { from: "CLAIMED", to: "CANCELLED" },
  pickup: { from: "CLAIMED", to: "PICKED_UP" },
  deliver: { from: "PICKED_UP", to: "DELIVERED" }
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const id = event.pathParameters?.id;
    const action = event.requestContext.http.path.split("/").at(-1) ?? "";
    const transition = actionMap[action];
    if (!id || !transition || !canTransition(transition.from, transition.to)) {
      return badRequest("Unsupported status transition");
    }

    const actor = actorId(event);
    const now = new Date().toISOString();
    const result = await db.send(new UpdateCommand({
      TableName: listingsTable,
      Key: { id },
      UpdateExpression: "SET #status = :to, statusHistory = list_append(if_not_exists(statusHistory, :empty), :history)",
      ConditionExpression: "attribute_exists(id) AND #status = :from AND claimedBy = :actor",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":from": transition.from,
        ":to": transition.to,
        ":actor": actor,
        ":empty": [],
        ":history": [statusEvent(transition.from, transition.to, actor, now)]
      },
      ReturnValues: "ALL_NEW"
    }));
    return json(200, result.Attributes);
  } catch (error) {
    if ((error as { name?: string }).name === "ConditionalCheckFailedException") {
      return json(409, { error: "STATUS_CONFLICT", message: "Listing status or actor does not allow this transition" });
    }
    if (error instanceof Error && error.message.includes("required")) return badRequest(error.message);
    return internalError(error);
  }
};
