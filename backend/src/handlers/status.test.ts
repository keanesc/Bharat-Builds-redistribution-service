import assert from "node:assert/strict";
import test from "node:test";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { ListingStatus, SurplusListing } from "@rescue-radius/shared";
import { db } from "../lib/db.js";
import { handler as statusHandler } from "./status.js";

const originalSend = db.send;

function mockStatusEvent(
  id?: string,
  action?: string,
  actor?: string,
  extraHeaders: Record<string, string> = {}
): APIGatewayProxyEventV2 {
  const headers: Record<string, string> = { ...extraHeaders };
  if (actor !== undefined) {
    headers["x-demo-actor"] = actor;
  }
  const path = `/listings/${id ?? ""}/${action ?? ""}`;
  return {
    headers,
    pathParameters: id !== undefined ? { id } : undefined,
    version: "2.0",
    routeKey: `POST /listings/{id}/${action ?? ""}`,
    rawPath: path,
    rawQueryString: "",
    requestContext: {
      accountId: "123",
      apiId: "api",
      domainName: "localhost",
      domainPrefix: "localhost",
      http: {
        method: "POST",
        path,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test"
      },
      requestId: "req-1",
      routeKey: `POST /listings/{id}/${action ?? ""}`,
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

function createMockListing(status: ListingStatus, claimedBy?: string): SurplusListing {
  return {
    id: "listing-001",
    restaurantId: "restaurant-001",
    restaurantName: "Koramangala Kitchen",
    foodDescription: "Packed meals",
    quantityMeals: 20,
    foodCategory: "VEG",
    latitude: 12.9352,
    longitude: 77.6245,
    packedAt: "2026-09-19T10:00:00.000Z",
    pickupDeadline: "2026-09-19T14:00:00.000Z",
    status,
    claimedBy,
    claimedAt: claimedBy ? "2026-09-19T10:15:00.000Z" : undefined,
    createdAt: "2026-09-19T10:00:00.000Z",
    statusHistory: [
      { from: null, to: "AVAILABLE", actorId: "restaurant-001", timestamp: "2026-09-19T10:00:00.000Z" },
      ...(claimedBy
        ? [{ from: "AVAILABLE" as ListingStatus, to: "CLAIMED" as ListingStatus, actorId: claimedBy, timestamp: "2026-09-19T10:15:00.000Z" }]
        : [])
    ]
  };
}

function setupMockDb(listing: SurplusListing) {
  db.send = (async (command: any) => {
    const input = command.input;
    const item = listing;

    const exists = Boolean(item && item.id === input.Key.id);
    const statusMatches = item.status === input.ExpressionAttributeValues[":from"];
    const actorMatches = item.claimedBy === input.ExpressionAttributeValues[":actor"];

    if (!exists || !statusMatches || !actorMatches) {
      const err = new Error("The conditional request failed");
      err.name = "ConditionalCheckFailedException";
      throw err;
    }

    item.status = input.ExpressionAttributeValues[":to"];
    item.statusHistory = [
      ...item.statusHistory,
      ...input.ExpressionAttributeValues[":history"]
    ];

    return { Attributes: { ...item } };
  }) as any;
}

test("pickup succeeds from CLAIMED when actor matches claimedBy", async () => {
  const listing = createMockListing("CLAIMED", "responder-001");
  setupMockDb(listing);

  const event = mockStatusEvent("listing-001", "pickup", "responder-001");
  const result = (await statusHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.equal(body.status, "PICKED_UP");
  assert.equal(body.statusHistory.length, 3);
  assert.equal(body.statusHistory[2].from, "CLAIMED");
  assert.equal(body.statusHistory[2].to, "PICKED_UP");
  assert.equal(body.statusHistory[2].actorId, "responder-001");
  assert.ok(body.statusHistory[2].timestamp);
});

test("pickup rejected when listing is not in CLAIMED state", async () => {
  const listing = createMockListing("AVAILABLE");
  setupMockDb(listing);

  const event = mockStatusEvent("listing-001", "pickup", "responder-001");
  const result = (await statusHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 409);
  const body = JSON.parse(result.body);
  assert.deepEqual(body, {
    error: "STATUS_CONFLICT",
    message: "Listing status or actor does not allow this transition"
  });
});

test("delivery succeeds from PICKED_UP when actor matches claimedBy", async () => {
  const listing = createMockListing("PICKED_UP", "responder-001");
  setupMockDb(listing);

  const event = mockStatusEvent("listing-001", "deliver", "responder-001");
  const result = (await statusHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.equal(body.status, "DELIVERED");
  assert.equal(body.statusHistory.at(-1)?.from, "PICKED_UP");
  assert.equal(body.statusHistory.at(-1)?.to, "DELIVERED");
});

test("delivery rejected when listing is not in PICKED_UP state", async () => {
  const listing = createMockListing("CLAIMED", "responder-001");
  setupMockDb(listing);

  const event = mockStatusEvent("listing-001", "deliver", "responder-001");
  const result = (await statusHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 409);
  const body = JSON.parse(result.body);
  assert.deepEqual(body, {
    error: "STATUS_CONFLICT",
    message: "Listing status or actor does not allow this transition"
  });
});

test("cancellation succeeds from supported CLAIMED state when actor matches claimedBy", async () => {
  const listing = createMockListing("CLAIMED", "responder-001");
  setupMockDb(listing);

  const event = mockStatusEvent("listing-001", "cancel", "responder-001");
  const result = (await statusHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.equal(body.status, "CANCELLED");
  assert.equal(body.statusHistory.at(-1)?.from, "CLAIMED");
  assert.equal(body.statusHistory.at(-1)?.to, "CANCELLED");
});

test("cancellation rejected when listing is in unsupported state like PICKED_UP", async () => {
  const listing = createMockListing("PICKED_UP", "responder-001");
  setupMockDb(listing);

  const event = mockStatusEvent("listing-001", "cancel", "responder-001");
  const result = (await statusHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 409);
  const body = JSON.parse(result.body);
  assert.equal(body.error, "STATUS_CONFLICT");
});

test("pickup, delivery, and cancellation require actor to equal claimedBy; unauthorized actor receives 409", async () => {
  // 1. Pickup by unauthorized actor
  const listing1 = createMockListing("CLAIMED", "responder-001");
  setupMockDb(listing1);
  const resPickup = (await statusHandler(
    mockStatusEvent("listing-001", "pickup", "responder-002"),
    dummyContext,
    dummyCallback
  )) as any;
  assert.equal(resPickup.statusCode, 409);
  assert.deepEqual(JSON.parse(resPickup.body), {
    error: "STATUS_CONFLICT",
    message: "Listing status or actor does not allow this transition"
  });

  // 2. Deliver by unauthorized actor
  const listing2 = createMockListing("PICKED_UP", "responder-001");
  setupMockDb(listing2);
  const resDeliver = (await statusHandler(
    mockStatusEvent("listing-001", "deliver", "responder-002"),
    dummyContext,
    dummyCallback
  )) as any;
  assert.equal(resDeliver.statusCode, 409);
  assert.deepEqual(JSON.parse(resDeliver.body), {
    error: "STATUS_CONFLICT",
    message: "Listing status or actor does not allow this transition"
  });

  // 3. Cancel by unauthorized actor
  const listing3 = createMockListing("CLAIMED", "responder-001");
  setupMockDb(listing3);
  const resCancel = (await statusHandler(
    mockStatusEvent("listing-001", "cancel", "responder-002"),
    dummyContext,
    dummyCallback
  )) as any;
  assert.equal(resCancel.statusCode, 409);
  assert.deepEqual(JSON.parse(resCancel.body), {
    error: "STATUS_CONFLICT",
    message: "Listing status or actor does not allow this transition"
  });
});

test("failed transitions do not mutate status or history in store", async () => {
  const listing = createMockListing("CLAIMED", "responder-001");
  const initialStatus = listing.status;
  const initialHistory = [...listing.statusHistory];
  setupMockDb(listing);

  // Attempt unauthorized transition
  const event = mockStatusEvent("listing-001", "pickup", "unauthorized-actor");
  const result = (await statusHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 409);
  assert.equal(listing.status, initialStatus);
  assert.deepEqual(listing.statusHistory, initialHistory);
});

test("every successful transition appends exactly one event and preserves existing history", async () => {
  const listing = createMockListing("CLAIMED", "responder-001");
  const initialHistory = [...listing.statusHistory];
  setupMockDb(listing);

  const event = mockStatusEvent("listing-001", "pickup", "responder-001");
  const result = (await statusHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);

  // Exactly one new event appended
  assert.equal(body.statusHistory.length, initialHistory.length + 1);

  // Existing history entries preserved intact
  for (let i = 0; i < initialHistory.length; i++) {
    assert.deepEqual(body.statusHistory[i], initialHistory[i]);
  }

  // New event has correct from, to, actorId, and timestamp
  const newEvent = body.statusHistory.at(-1);
  assert.equal(newEvent.from, "CLAIMED");
  assert.equal(newEvent.to, "PICKED_UP");
  assert.equal(newEvent.actorId, "responder-001");
  assert.ok(!isNaN(new Date(newEvent.timestamp).getTime()));
});

test("unsupported status action returns 400", async () => {
  const event = mockStatusEvent("listing-001", "unsupported-action", "responder-001");
  const result = (await statusHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 400);
  const body = JSON.parse(result.body);
  assert.equal(body.error, "BAD_REQUEST");
  assert.match(body.message, /Unsupported status transition/);
});

test("missing X-Demo-Actor header returns 400", async () => {
  const event = mockStatusEvent("listing-001", "pickup", undefined);
  const result = (await statusHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 400);
  const body = JSON.parse(result.body);
  assert.equal(body.error, "BAD_REQUEST");
  assert.match(body.message, /X-Demo-Actor header is required/);
});
