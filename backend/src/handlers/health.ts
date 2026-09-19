import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { json } from "../lib/http.js";

export const handler: APIGatewayProxyHandlerV2 = async () =>
  json(200, { ok: true, service: "rescue-radius-api", region: process.env.AWS_REGION ?? "ap-south-1" });
