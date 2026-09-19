import assert from "node:assert/strict";
import test from "node:test";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { ResponderProfile } from "@rescue-radius/shared";
import { db } from "../lib/db.js";
import { handler as profilesHandler } from "./profiles.js";

const originalSend = db.send;
test.afterEach(() => {
  db.send = originalSend;
});

function mockProfileEvent(method: string, id?: string): APIGatewayProxyEventV2 {
  const path = id ? `/profiles/${id}` : "/profiles";
  return {
    headers: {},
    pathParameters: id ? { id } : undefined,
    version: "2.0",
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: "",
    requestContext: {
      accountId: "123",
      apiId: "api",
      domainName: "localhost",
      domainPrefix: "localhost",
      http: {
        method,
        path,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test"
      },
      requestId: "req-1",
      routeKey: `${method} ${path}`,
      stage: "$default",
      time: "01/Jan/2026:00:00:00 +0000",
      timeEpoch: 0
    },
    isBase64Encoded: false
  } as unknown as APIGatewayProxyEventV2;
}

const dummyContext = {} as any;
const dummyCallback = () => {};

test("GET /profiles returns list of all profiles", async () => {
  const profiles: ResponderProfile[] = [
    {
      id: "responder-001",
      name: "Hope Kitchen NGO",
      role: "NGO",
      latitude: 12.9352,
      longitude: 77.6245,
      capacityMeals: 50,
      foodPreferences: ["VEG"],
      verified: true
    }
  ];

  db.send = (async () => ({ Items: profiles })) as any;

  const event = mockProfileEvent("GET");
  const result = (await profilesHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.equal(body.profiles.length, 1);
  assert.equal(body.profiles[0].id, "responder-001");
});

test("GET /profiles/{id} returns profile when found", async () => {
  const profile: ResponderProfile = {
    id: "responder-001",
    name: "Hope Kitchen NGO",
    role: "NGO",
    latitude: 12.9352,
    longitude: 77.6245,
    capacityMeals: 50,
    foodPreferences: ["VEG"],
    verified: true
  };

  db.send = (async () => ({ Item: profile })) as any;

  const event = mockProfileEvent("GET", "responder-001");
  const result = (await profilesHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.equal(body.id, "responder-001");
  assert.equal(body.name, "Hope Kitchen NGO");
});

test("GET /profiles/{id} returns 404 when profile not found", async () => {
  db.send = (async () => ({ Item: undefined })) as any;

  const event = mockProfileEvent("GET", "unknown-profile");
  const result = (await profilesHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 404);
  const body = JSON.parse(result.body);
  assert.deepEqual(body, { error: "NOT_FOUND", message: "Profile not found" });
});

test("POST /profiles returns 405 METHOD_NOT_ALLOWED", async () => {
  const event = mockProfileEvent("POST");
  const result = (await profilesHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 405);
  const body = JSON.parse(result.body);
  assert.equal(body.error, "METHOD_NOT_ALLOWED");
});
