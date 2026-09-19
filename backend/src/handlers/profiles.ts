import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { ResponderProfile } from "@rescue-radius/shared";
import { db, profilesTable } from "../lib/db.js";
import { internalError, json } from "../lib/http.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const method = event.requestContext.http.method;
    const id = event.pathParameters?.id;

    if (method === "GET" && id) {
      const result = await db.send(new GetCommand({ TableName: profilesTable, Key: { id } }));
      if (!result.Item) return json(404, { error: "NOT_FOUND", message: "Profile not found" });
      return json(200, result.Item as ResponderProfile);
    }

    if (method === "GET") {
      const result = await db.send(new ScanCommand({ TableName: profilesTable }));
      const profiles = (result.Items as ResponderProfile[] | undefined) ?? [];
      return json(200, { profiles });
    }

    return json(405, { error: "METHOD_NOT_ALLOWED", message: "Only GET is supported" });
  } catch (error) {
    return internalError(error);
  }
};
