import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";

const headers = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type,x-demo-actor",
  "access-control-allow-methods": "GET,POST,OPTIONS"
};

export function json(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body)
  };
}

export function parseBody<T>(event: APIGatewayProxyEventV2): T {
  if (!event.body) {
    throw new Error("Request body is required");
  }

  try {
    return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body) as T;
  } catch {
    throw new Error("Request body must be valid JSON");
  }
}

export function actorId(event: APIGatewayProxyEventV2): string {
  const value = event.headers["x-demo-actor"] ?? event.headers["X-Demo-Actor"];
  if (!value) {
    throw new Error("X-Demo-Actor header is required");
  }
  return value;
}

export function badRequest(message: string): APIGatewayProxyStructuredResultV2 {
  return json(400, { error: "BAD_REQUEST", message });
}

export function internalError(error: unknown): APIGatewayProxyStructuredResultV2 {
  console.error(error);
  return json(500, { error: "INTERNAL_ERROR", message: "Unexpected server error" });
}
