import assert from "node:assert/strict";
import test from "node:test";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handler as healthHandler } from "./health.js";

const dummyEvent = {} as APIGatewayProxyEventV2;
const dummyContext = {} as any;
const dummyCallback = () => {};

test("GET /health returns 200 with service status", async () => {
  const result = (await healthHandler(dummyEvent, dummyContext, dummyCallback)) as any;
  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.deepEqual(body, {
    ok: true,
    service: "rescue-radius-api",
    region: process.env.AWS_REGION ?? "ap-south-1"
  });
});
