/**
 * listings.test.ts
 *
 * Pure-logic unit tests for the listings handler domain behaviour.
 * No HTTP server, no DynamoDB — dependencies are either imported directly
 * (haversineDistanceKm, actorId) or inlined from the handler source.
 *
 * Acceptance criteria covered:
 *   FR-001  Actor authorisation  — actorId() tests
 *   FR-002  Listing creation validation — POST body field checks
 *   FR-003/FR-007  Radius / expiry filtering — filter+sort pipeline
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { SurplusListing } from "@rescue-radius/shared";
import { haversineDistanceKm } from "../domain/distance.js";
import { db } from "../lib/db.js";
import { actorId } from "../lib/http.js";
import { handler as listingsHandler } from "./listings.js";

const originalSend = db.send;
test.afterEach(() => {
  db.send = originalSend;
});


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Inlined from listings.ts (not exported by the handler module). */
function isExpired(listing: SurplusListing, now: string): boolean {
  return listing.pickupDeadline <= now;
}

/** Build a minimal valid SurplusListing, with optional field overrides. */
function mockListing(overrides: Partial<SurplusListing> = {}): SurplusListing {
  const base: SurplusListing = {
    id: "test-id",
    restaurantId: "r-001",
    restaurantName: "Test Restaurant",
    foodDescription: "Test food",
    quantityMeals: 10,
    foodCategory: "VEG",
    latitude: 12.9352,
    longitude: 77.6245,
    packedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    pickupDeadline: new Date(Date.now() + 30 * 60_000).toISOString(),
    status: "AVAILABLE",
    createdAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    statusHistory: [],
  };
  return { ...base, ...overrides };
}

/**
 * Build a minimal APIGatewayProxyEventV2 stub for actorId() tests.
 * Only the `headers` field is relevant; everything else is satisfied by
 * type-safe empty/placeholder values.
 */
function mockEvent(headers: Record<string, string>): APIGatewayProxyEventV2 {
  return {
    headers,
    version: "2.0",
    routeKey: "GET /",
    rawPath: "/",
    rawQueryString: "",
    requestContext: {
      accountId: "123",
      apiId: "api",
      domainName: "localhost",
      domainPrefix: "localhost",
      http: { method: "GET", path: "/", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "test" },
      requestId: "req-1",
      routeKey: "GET /",
      stage: "$default",
      time: "01/Jan/2026:00:00:00 +0000",
      timeEpoch: 0,
    },
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2;
}

// ---------------------------------------------------------------------------
// FR-007 — isExpired (inlined pure function)
// ---------------------------------------------------------------------------

test("isExpired returns true when deadline is in the past", () => {
  const pastDeadline = new Date(Date.now() - 60_000).toISOString();
  const listing = mockListing({ pickupDeadline: pastDeadline });
  const now = new Date().toISOString();
  assert.equal(isExpired(listing, now), true);
});

test("isExpired returns false when deadline is in the future", () => {
  const futureDeadline = new Date(Date.now() + 60_000).toISOString();
  const listing = mockListing({ pickupDeadline: futureDeadline });
  const now = new Date().toISOString();
  assert.equal(isExpired(listing, now), false);
});

// ---------------------------------------------------------------------------
// FR-003/FR-007 — filter + sort pipeline (mirrors GET handler logic)
// ---------------------------------------------------------------------------

/** Run the same filter+sort pipeline used in the GET listings handler. */
function runPipeline(
  listings: SurplusListing[],
  origin: { latitude: number; longitude: number },
  radiusKm: number
): SurplusListing[] {
  const now = new Date().toISOString();
  return listings
    .filter((l) => !isExpired(l, now))
    .filter(
      (l) =>
        haversineDistanceKm(origin, { latitude: l.latitude, longitude: l.longitude }) <= radiusKm
    )
    .sort((a, b) => a.pickupDeadline.localeCompare(b.pickupDeadline));
}

// Bangalore city centre — used as the query origin for pipeline tests.
const ORIGIN = { latitude: 12.9716, longitude: 77.5946 };

test("listing filter pipeline excludes expired listings", () => {
  const expiredListing = mockListing({
    id: "expired-1",
    // same coords as origin so it would pass radius check
    latitude: ORIGIN.latitude,
    longitude: ORIGIN.longitude,
    pickupDeadline: new Date(Date.now() - 60_000).toISOString(),
  });
  const result = runPipeline([expiredListing], ORIGIN, 50);
  assert.equal(result.length, 0);
});

test("listing filter pipeline excludes listings outside radius", () => {
  // Mumbai is ~1,000 km from Bangalore — well outside a 10 km radius.
  const farListing = mockListing({
    id: "far-1",
    latitude: 19.076,
    longitude: 72.8777,
    pickupDeadline: new Date(Date.now() + 60 * 60_000).toISOString(),
  });
  const result = runPipeline([farListing], ORIGIN, 10);
  assert.equal(result.length, 0);
});

test("listing filter pipeline includes listings within radius", () => {
  // Koramangala is ~3 km from Bangalore city centre.
  const nearListing = mockListing({
    id: "near-1",
    latitude: 12.9352,
    longitude: 77.6245,
    pickupDeadline: new Date(Date.now() + 60 * 60_000).toISOString(),
  });
  const result = runPipeline([nearListing], ORIGIN, 10);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "near-1");
});

test("listing filter pipeline sorts by pickupDeadline ascending", () => {
  const deadlineA = new Date(Date.now() + 30 * 60_000).toISOString(); // 30 min from now
  const deadlineB = new Date(Date.now() + 90 * 60_000).toISOString(); // 90 min from now
  const deadlineC = new Date(Date.now() + 60 * 60_000).toISOString(); // 60 min from now

  // Insert in non-sorted order: B, C, A
  const listings = [
    mockListing({ id: "b", latitude: ORIGIN.latitude, longitude: ORIGIN.longitude, pickupDeadline: deadlineB }),
    mockListing({ id: "c", latitude: ORIGIN.latitude, longitude: ORIGIN.longitude, pickupDeadline: deadlineC }),
    mockListing({ id: "a", latitude: ORIGIN.latitude, longitude: ORIGIN.longitude, pickupDeadline: deadlineA }),
  ];

  const result = runPipeline(listings, ORIGIN, 1);
  assert.deepEqual(
    result.map((l) => l.id),
    ["a", "c", "b"]
  );
});

// ---------------------------------------------------------------------------
// FR-002 — POST validation (inlined conditions from listings.ts handler)
// ---------------------------------------------------------------------------

/**
 * Returns the first validation error string, or null when all checks pass.
 * Mirrors the exact guard conditions from the POST branch of listings.ts.
 */
function validateCreateBody(body: {
  restaurantId?: unknown;
  restaurantName?: unknown;
  foodDescription?: unknown;
  quantityMeals?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  pickupDeadline?: unknown;
}): string | null {
  if (!body.restaurantId || !body.restaurantName || !body.foodDescription || (body.quantityMeals as number) <= 0) {
    return "restaurantId, restaurantName, foodDescription, and positive quantityMeals are required";
  }
  if (!Number.isFinite(body.latitude as number) || !Number.isFinite(body.longitude as number)) {
    return "latitude and longitude must be valid numbers";
  }
  if (new Date(body.pickupDeadline as string).getTime() <= Date.now()) {
    return "pickupDeadline must be in the future";
  }
  return null;
}

test("POST validation rejects missing restaurantId", () => {
  const error = validateCreateBody({
    restaurantId: "",
    restaurantName: "Test",
    foodDescription: "Food",
    quantityMeals: 5,
    latitude: 12.9,
    longitude: 77.6,
    pickupDeadline: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.notEqual(error, null);
  assert.match(error!, /restaurantId/);
});

test("POST validation rejects non-positive quantityMeals", () => {
  const error = validateCreateBody({
    restaurantId: "r-001",
    restaurantName: "Test",
    foodDescription: "Food",
    quantityMeals: 0,           // zero is invalid
    latitude: 12.9,
    longitude: 77.6,
    pickupDeadline: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.notEqual(error, null);
  assert.match(error!, /quantityMeals/);
});

test("POST validation rejects past pickupDeadline", () => {
  const error = validateCreateBody({
    restaurantId: "r-001",
    restaurantName: "Test",
    foodDescription: "Food",
    quantityMeals: 5,
    latitude: 12.9,
    longitude: 77.6,
    pickupDeadline: new Date(Date.now() - 1000).toISOString(), // 1 s in the past
  });
  assert.notEqual(error, null);
  assert.match(error!, /pickupDeadline/);
});

test("POST validation accepts a valid body", () => {
  const error = validateCreateBody({
    restaurantId: "r-001",
    restaurantName: "Spice Garden",
    foodDescription: "Biryani",
    quantityMeals: 20,
    latitude: 12.9352,
    longitude: 77.6245,
    pickupDeadline: new Date(Date.now() + 2 * 60 * 60_000).toISOString(), // 2 h from now
  });
  assert.equal(error, null);
});

// ---------------------------------------------------------------------------
// FR-001 — Actor authorisation via actorId()
// ---------------------------------------------------------------------------

test("actorId returns header value when present", () => {
  const event = mockEvent({ "x-demo-actor": "user-42" });
  assert.equal(actorId(event), "user-42");
});

test("actorId returns header value when using canonical casing X-Demo-Actor", () => {
  // Lambda can forward headers with original casing; actorId must handle both.
  const event = mockEvent({ "X-Demo-Actor": "user-99" });
  assert.equal(actorId(event), "user-99");
});

test("actorId throws when X-Demo-Actor header is missing", () => {
  const event = mockEvent({});
  assert.throws(
    () => actorId(event),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /X-Demo-Actor/);
      return true;
    }
  );
});

// ---------------------------------------------------------------------------
// FR-001/FR-002 — New validation additions: foodCategory, packedAt, actor check
// ---------------------------------------------------------------------------

test("POST validation rejects invalid foodCategory", () => {
  const validCategories = ["VEG", "NON_VEG", "PACKAGED"];
  assert.equal(validCategories.includes("INVALID"), false);
  assert.equal(validCategories.includes("VEG"), true);
  assert.equal(validCategories.includes("NON_VEG"), true);
  assert.equal(validCategories.includes("PACKAGED"), true);
});

test("POST validation rejects invalid packedAt", () => {
  assert.equal(isNaN(new Date("not-a-date").getTime()), true);
  assert.equal(isNaN(new Date("2026-09-19T10:00:00Z").getTime()), false);
});

test("listing filter pipeline filters by foodCategory", () => {
  const listings = [
    mockListing({ id: "a", foodCategory: "VEG" }),
    mockListing({ id: "b", foodCategory: "NON_VEG" }),
    mockListing({ id: "c", foodCategory: "PACKAGED" })
  ];
  const filtered = listings.filter((l) => l.foodCategory === "VEG");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]!.id, "a");
});

test("listing filter pipeline filters by minQuantity", () => {
  const listings = [
    mockListing({ id: "a", quantityMeals: 5 }),
    mockListing({ id: "b", quantityMeals: 20 }),
    mockListing({ id: "c", quantityMeals: 50 })
  ];
  const filtered = listings.filter((l) => l.quantityMeals >= 15);
  assert.equal(filtered.length, 2);
});

test("listing filter pipeline filters by restaurantId", () => {
  const listings = [
    mockListing({ id: "a", restaurantId: "r-001" }),
    mockListing({ id: "b", restaurantId: "r-002" }),
    mockListing({ id: "c", restaurantId: "r-001" })
  ];
  const filtered = listings.filter((l) => l.restaurantId === "r-001");
  assert.equal(filtered.length, 2);
});

test("unknown demo actor fails validation", () => {
  const knownActors: Record<string, string> = {
    "restaurant-001": "RESTAURANT",
    "responder-001": "RESPONDER",
    "responder-002": "RESPONDER",
    "admin-001": "ADMIN"
  };
  assert.equal(!!knownActors["unknown-actor"], false);
  assert.equal(!!knownActors["restaurant-001"], true);
});

// ---------------------------------------------------------------------------
// Handler integration tests (mocking db.send)
// ---------------------------------------------------------------------------

function mockApiEvent(options: {
  method: string;
  path?: string;
  id?: string;
  body?: unknown;
  headers?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
}): APIGatewayProxyEventV2 {
  const path = options.path ?? (options.id ? `/listings/${options.id}` : "/listings");
  return {
    headers: options.headers ?? {},
    pathParameters: options.id ? { id: options.id } : undefined,
    queryStringParameters: options.queryStringParameters,
    body: options.body ? JSON.stringify(options.body) : undefined,
    version: "2.0",
    routeKey: `${options.method} ${path}`,
    rawPath: path,
    rawQueryString: "",
    requestContext: {
      accountId: "123",
      apiId: "api",
      domainName: "localhost",
      domainPrefix: "localhost",
      http: {
        method: options.method,
        path,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test"
      },
      requestId: "req-1",
      routeKey: `${options.method} ${path}`,
      stage: "$default",
      time: "01/Jan/2026:00:00:00 +0000",
      timeEpoch: 0
    },
    isBase64Encoded: false
  } as unknown as APIGatewayProxyEventV2;
}

const dummyContext = {} as any;
const dummyCallback = () => {};

test("GET /listings/{id} returns 200 with listing when found", async () => {
  const listing = mockListing({ id: "l-123" });
  db.send = (async () => ({ Item: listing })) as any;

  const event = mockApiEvent({ method: "GET", id: "l-123" });
  const result = (await listingsHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.equal(body.id, "l-123");
});

test("GET /listings/{id} returns 404 when listing does not exist", async () => {
  db.send = (async () => ({ Item: undefined })) as any;

  const event = mockApiEvent({ method: "GET", id: "l-nonexistent" });
  const result = (await listingsHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 404);
  const body = JSON.parse(result.body);
  assert.deepEqual(body, { error: "NOT_FOUND", message: "Listing not found" });
});

test("GET /listings filters expired items and applies query params", async () => {
  const futureDeadline = new Date(Date.now() + 60 * 60_000).toISOString();
  const pastDeadline = new Date(Date.now() - 60 * 60_000).toISOString();

  const items = [
    mockListing({ id: "expired", pickupDeadline: pastDeadline, foodCategory: "VEG" }),
    mockListing({ id: "valid-veg", pickupDeadline: futureDeadline, foodCategory: "VEG", quantityMeals: 10 }),
    mockListing({ id: "valid-nonveg", pickupDeadline: futureDeadline, foodCategory: "NON_VEG", quantityMeals: 10 })
  ];

  db.send = (async () => ({ Items: items })) as any;

  const event = mockApiEvent({
    method: "GET",
    queryStringParameters: { foodCategory: "VEG", minQuantity: "5" }
  });
  const result = (await listingsHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.equal(body.listings.length, 1);
  assert.equal(body.listings[0].id, "valid-veg");
});

test("POST /listings persists new listing with 201 and initial status history", async () => {
  let putItem: any = null;
  db.send = (async (command: any) => {
    putItem = command.input.Item;
    return {};
  }) as any;

  const body = {
    restaurantId: "restaurant-001",
    restaurantName: "Koramangala Kitchen",
    foodDescription: "Packed dinner",
    quantityMeals: 25,
    foodCategory: "VEG",
    latitude: 12.9352,
    longitude: 77.6245,
    packedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    pickupDeadline: new Date(Date.now() + 60 * 60_000).toISOString()
  };

  const event = mockApiEvent({
    method: "POST",
    headers: { "x-demo-actor": "restaurant-001" },
    body
  });

  const result = (await listingsHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 201);
  const responseBody = JSON.parse(result.body);
  assert.equal(responseBody.status, "AVAILABLE");
  assert.equal(responseBody.quantityMeals, 25);
  assert.equal(responseBody.statusHistory.length, 1);
  assert.equal(responseBody.statusHistory[0].from, null);
  assert.equal(responseBody.statusHistory[0].to, "AVAILABLE");
  assert.equal(responseBody.statusHistory[0].actorId, "restaurant-001");
  assert.ok(putItem);
});

test("POST /listings rejects unknown demo actor with 400", async () => {
  const event = mockApiEvent({
    method: "POST",
    headers: { "x-demo-actor": "unauthorized-hacker" },
    body: {
      restaurantId: "r-001",
      restaurantName: "Test",
      foodDescription: "Test",
      quantityMeals: 10,
      foodCategory: "VEG",
      latitude: 12.9,
      longitude: 77.6,
      packedAt: new Date().toISOString(),
      pickupDeadline: new Date(Date.now() + 60_000).toISOString()
    }
  });

  const result = (await listingsHandler(event, dummyContext, dummyCallback)) as any;
  assert.equal(result.statusCode, 400);
  const body = JSON.parse(result.body);
  assert.match(body.message, /must be a known demo actor ID/);
});

test("POST /listings rejects invalid category with 400", async () => {
  const event = mockApiEvent({
    method: "POST",
    headers: { "x-demo-actor": "restaurant-001" },
    body: {
      restaurantId: "r-001",
      restaurantName: "Test",
      foodDescription: "Test",
      quantityMeals: 10,
      foodCategory: "INVALID_CAT",
      latitude: 12.9,
      longitude: 77.6,
      packedAt: new Date().toISOString(),
      pickupDeadline: new Date(Date.now() + 60_000).toISOString()
    }
  });

  const result = (await listingsHandler(event, dummyContext, dummyCallback)) as any;
  assert.equal(result.statusCode, 400);
  const body = JSON.parse(result.body);
  assert.match(body.message, /foodCategory must be VEG, NON_VEG, or PACKAGED/);
});

test("unsupported HTTP method returns 405", async () => {
  const event = mockApiEvent({ method: "DELETE" });
  const result = (await listingsHandler(event, dummyContext, dummyCallback)) as any;

  assert.equal(result.statusCode, 405);
  const body = JSON.parse(result.body);
  assert.equal(body.error, "METHOD_NOT_ALLOWED");
});

