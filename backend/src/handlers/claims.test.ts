import assert from "node:assert/strict";
import test from "node:test";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { SurplusListing } from "@rescue-radius/shared";
import { db } from "../lib/db.js";
import { handler as claimsHandler } from "./claims.js";

// Save original db.send so we can restore it after every test
const originalSend = db.send;

function mockClaimEvent(
  id?: string,
  actor?: string,
  extraHeaders: Record<string, string> = {}
): APIGatewayProxyEventV2 {
  const headers: Record<string, string> = { ...extraHeaders };
  if (actor !== undefined) {
    headers["x-demo-actor"] = actor;
  }
  return {
    headers,
    pathParameters: id !== undefined ? { id } : undefined,
    version: "2.0",
    routeKey: "POST /listings/{id}/claim",
    rawPath: `/listings/${id ?? ""}/claim`,
    rawQueryString: "",
    requestContext: {
      accountId: "123",
      apiId: "api",
      domainName: "localhost",
      domainPrefix: "localhost",
      http: {
        method: "POST",
        path: `/listings/${id ?? ""}/claim`,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test"
      },
      requestId: "req-1",
      routeKey: "POST /listings/{id}/claim",
      stage: "$default",
      time: "01/Jan/2026:00:00:00 +0000",
      timeEpoch: 0
    },
    isBase64Encoded: false
  } as unknown as APIGatewayProxyEventV2;
}

const dummyContext = {} as any;
const dummyCallback = () => {};

test.afterEach(() => {
  db.send = originalSend;
});

test("simulates two responders claiming the same available listing; exactly one succeeds and competitor gets 409", async () => {
  // In-memory representation of a listing in DynamoDB
  const listing: SurplusListing = {
    id: "listing-001",
    restaurantId: "restaurant-001",
    restaurantName: "Koramangala Kitchen",
    foodDescription: "Packed rice and dal",
    quantityMeals: 20,
    foodCategory: "VEG",
    latitude: 12.9352,
    longitude: 77.6245,
    packedAt: "2026-09-19T10:00:00.000Z",
    pickupDeadline: new Date(Date.now() + 60 * 60_000).toISOString(),
    status: "AVAILABLE",
    createdAt: "2026-09-19T10:00:00.000Z",
    statusHistory: [
      { from: null, to: "AVAILABLE", actorId: "restaurant-001", timestamp: "2026-09-19T10:00:00.000Z" }
    ]
  };

  // Atomic in-memory conditional update simulator
  db.send = (async (command: any) => {
    const input = command.input;
    const item = listing;

    // Evaluate ConditionExpression: attribute_exists(id) AND #status = :available AND pickupDeadline > :now
    const exists = Boolean(item && item.id === input.Key.id);
    const statusMatches = item.status === input.ExpressionAttributeValues[":available"];
    const notExpired = item.pickupDeadline > input.ExpressionAttributeValues[":now"];

    if (!exists || !statusMatches || !notExpired) {
      const err = new Error("The conditional request failed");
      err.name = "ConditionalCheckFailedException";
      throw err;
    }

    // Apply update atomically
    item.status = input.ExpressionAttributeValues[":claimed"];
    item.claimedBy = input.ExpressionAttributeValues[":actor"];
    item.claimedAt = input.ExpressionAttributeValues[":now"];
    item.statusHistory = [
      ...item.statusHistory,
      ...input.ExpressionAttributeValues[":history"]
    ];

    return { Attributes: { ...item } };
  }) as any;

  // Simulate two concurrent claims from different responders
  const eventA = mockClaimEvent("listing-001", "responder-001");
  const eventB = mockClaimEvent("listing-001", "responder-002");

  const [resA, resB] = await Promise.all([
    claimsHandler(eventA, dummyContext, dummyCallback),
    claimsHandler(eventB, dummyContext, dummyCallback)
  ]);

  const results = [resA as any, resB as any];
  const success = results.find((r) => r.statusCode === 200);
  const conflict = results.find((r) => r.statusCode === 409);

  // Prove exactly one succeeds and one receives 409
  assert.ok(success, "One claim must succeed with 200");
  assert.ok(conflict, "One claim must fail with 409");

  // Verify conflict payload
  const conflictBody = JSON.parse(conflict.body);
  assert.deepEqual(conflictBody, {
    error: "CLAIM_CONFLICT",
    message: "Listing is already claimed, cancelled, or expired"
  });

  // Verify successful claim updated listing correctly
  const successBody = JSON.parse(success.body);
  assert.equal(successBody.status, "CLAIMED");
  assert.ok(["responder-001", "responder-002"].includes(successBody.claimedBy));
  assert.ok(successBody.claimedAt);
});

test("verify DynamoDB update condition requires existence, AVAILABLE status, and pickupDeadline > now", async () => {
  let capturedInput: any = null;

  db.send = (async (command: any) => {
    capturedInput = command.input;
    return {
      Attributes: {
        id: "listing-001",
        status: "CLAIMED",
        claimedBy: "responder-001",
        claimedAt: "2026-09-19T10:05:00.000Z",
        statusHistory: []
      }
    };
  }) as any;

  const event = mockClaimEvent("listing-001", "responder-001");
  const result = (await claimsHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 200);
  assert.ok(capturedInput);

  // Check ConditionExpression exactly matches requirement
  assert.equal(
    capturedInput.ConditionExpression,
    "attribute_exists(id) AND #status = :available AND pickupDeadline > :now"
  );
  assert.equal(capturedInput.ExpressionAttributeNames["#status"], "status");
  assert.equal(capturedInput.ExpressionAttributeValues[":available"], "AVAILABLE");
  assert.equal(capturedInput.ExpressionAttributeValues[":claimed"], "CLAIMED");
  assert.equal(capturedInput.ExpressionAttributeValues[":actor"], "responder-001");
  assert.ok(capturedInput.ExpressionAttributeValues[":now"]);
});

test("claim at or after deadline fails with 409 CLAIM_CONFLICT", async (t) => {
  for (const deadlineOffsetMs of [0, -1]) {
    await t.test(deadlineOffsetMs === 0 ? "at deadline" : "after deadline", async () => {
      db.send = (async (command: any) => {
        const input = command.input;
        const now = input.ExpressionAttributeValues[":now"] as string;
        const pickupDeadline = new Date(new Date(now).getTime() + deadlineOffsetMs).toISOString();

        assert.equal(pickupDeadline > now, false, "DynamoDB pickupDeadline > :now condition must fail");
        const error = new Error("Conditional check failed");
        error.name = "ConditionalCheckFailedException";
        throw error;
      }) as any;

      const event = mockClaimEvent("listing-001", "responder-001");
      const result = (await claimsHandler(event, dummyContext, dummyCallback)) as any;

      assert.equal(result.statusCode, 409);
      assert.deepEqual(JSON.parse(result.body), {
        error: "CLAIM_CONFLICT",
        message: "Listing is already claimed, cancelled, or expired"
      });
    });
  }
});

test("successful claim preserves existing history and appends an event with actor and timestamp", async () => {
  const initialHistory = [
    { from: null, to: "AVAILABLE" as const, actorId: "restaurant-001", timestamp: "2026-09-19T09:00:00.000Z" }
  ];

  db.send = (async (command: any) => {
    const input = command.input;
    const historyToAppend = input.ExpressionAttributeValues[":history"];
    return {
      Attributes: {
        id: "listing-001",
        status: "CLAIMED",
        claimedBy: input.ExpressionAttributeValues[":actor"],
        claimedAt: input.ExpressionAttributeValues[":now"],
        statusHistory: [...initialHistory, ...historyToAppend]
      }
    };
  }) as any;

  const event = mockClaimEvent("listing-001", "responder-001");
  const result = (await claimsHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.equal(body.statusHistory.length, 2);
  assert.deepEqual(body.statusHistory[0], initialHistory[0]);
  assert.equal(body.statusHistory[1].from, "AVAILABLE");
  assert.equal(body.statusHistory[1].to, "CLAIMED");
  assert.equal(body.statusHistory[1].actorId, "responder-001");
  assert.ok(body.statusHistory[1].timestamp);
});

test("missing X-Demo-Actor produces 400 response with error details", async () => {
  const event = mockClaimEvent("listing-001", undefined);
  const result = (await claimsHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 400);
  const body = JSON.parse(result.body);
  assert.equal(body.error, "BAD_REQUEST");
  assert.match(body.message, /X-Demo-Actor header is required/);
});

test("missing listing id produces 400 response", async () => {
  const event = mockClaimEvent(undefined, "responder-001");
  const result = (await claimsHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 400);
  const body = JSON.parse(result.body);
  assert.equal(body.error, "BAD_REQUEST");
  assert.match(body.message, /listing id is required/);
});
