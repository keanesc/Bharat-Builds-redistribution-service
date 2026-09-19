import assert from "node:assert/strict";
import test from "node:test";
import type { ResponderProfile, SurplusListing } from "@rescue-radius/shared";
import { haversineDistanceKm } from "./distance.js";
import { rankResponders } from "./matching.js";

function mockListing(overrides: Partial<SurplusListing> = {}): SurplusListing {
  return {
    id: "listing-001",
    restaurantId: "restaurant-001",
    restaurantName: "Koramangala Kitchen",
    foodDescription: "Packed meals",
    quantityMeals: 10,
    foodCategory: "VEG",
    latitude: 12.9352,
    longitude: 77.6245,
    packedAt: "2026-09-19T10:00:00.000Z",
    pickupDeadline: "2026-09-19T12:00:00.000Z",
    status: "AVAILABLE",
    createdAt: "2026-09-19T10:00:00.000Z",
    statusHistory: [],
    ...overrides
  };
}

function mockResponder(overrides: Partial<ResponderProfile> = {}): ResponderProfile {
  return {
    id: "responder-001",
    name: "Hope Kitchen",
    role: "NGO",
    latitude: 12.9352,
    longitude: 77.6245,
    capacityMeals: 50,
    foodPreferences: ["VEG", "PACKAGED"],
    verified: true,
    ...overrides
  };
}

test("verified responders are eligible", () => {
  const listing = mockListing();
  const responder = mockResponder({ verified: true });
  const matches = rankResponders(listing, [responder], {
    now: "2026-09-19T10:00:00.000Z"
  });
  assert.equal(matches.length, 1);
  assert.equal(matches[0]!.responder.id, "responder-001");
});

test("unverified responders are rejected", () => {
  const listing = mockListing();
  const responder = mockResponder({ verified: false });
  const matches = rankResponders(listing, [responder], {
    now: "2026-09-19T10:00:00.000Z"
  });
  assert.equal(matches.length, 0);
});

test("insufficient capacity is rejected", () => {
  const listing = mockListing({ quantityMeals: 30 });
  const smallResponder = mockResponder({ id: "small", capacityMeals: 20 });
  const exactResponder = mockResponder({ id: "exact", capacityMeals: 30 });
  const largeResponder = mockResponder({ id: "large", capacityMeals: 50 });

  const matches = rankResponders(listing, [smallResponder, exactResponder, largeResponder], {
    now: "2026-09-19T10:00:00.000Z"
  });

  const matchedIds = matches.map((m) => m.responder.id);
  assert.ok(!matchedIds.includes("small"), "responder with capacity < quantity must be rejected");
  assert.ok(matchedIds.includes("exact"), "responder with capacity == quantity must be accepted");
  assert.ok(matchedIds.includes("large"), "responder with capacity > quantity must be accepted");
});

test("incompatible food preferences are rejected", () => {
  const listing = mockListing({ foodCategory: "NON_VEG" });
  const vegOnly = mockResponder({ id: "veg", foodPreferences: ["VEG", "PACKAGED"] });
  const nonVeg = mockResponder({ id: "non-veg", foodPreferences: ["VEG", "NON_VEG"] });

  const matches = rankResponders(listing, [vegOnly, nonVeg], {
    now: "2026-09-19T10:00:00.000Z"
  });

  assert.equal(matches.length, 1);
  assert.equal(matches[0]!.responder.id, "non-veg");
});

test("responders exactly at the configured radius are accepted", () => {
  const listing = mockListing({ latitude: 12.9352, longitude: 77.6245 });
  // Responder at Indiranagar
  const responder = mockResponder({ latitude: 12.9784, longitude: 77.6408 });
  const distance = haversineDistanceKm(
    { latitude: listing.latitude, longitude: listing.longitude },
    { latitude: responder.latitude, longitude: responder.longitude }
  );

  // Configure radiusKm to be exactly the distance
  const matches = rankResponders(listing, [responder], {
    now: "2026-09-19T10:00:00.000Z",
    radiusKm: distance,
    travelSpeedKmh: 100 // High travel speed so remaining window doesn't constrain
  });

  assert.equal(matches.length, 1);
  assert.equal(matches[0]!.responder.id, responder.id);
  assert.ok(Math.abs(matches[0]!.distanceKm - distance) < 1e-9);
});

test("responders beyond the radius are rejected", () => {
  const listing = mockListing({ latitude: 12.9352, longitude: 77.6245 });
  const responder = mockResponder({ latitude: 12.9784, longitude: 77.6408 });
  const distance = haversineDistanceKm(
    { latitude: listing.latitude, longitude: listing.longitude },
    { latitude: responder.latitude, longitude: responder.longitude }
  );

  // Configure radiusKm to be slightly less than the distance
  const matches = rankResponders(listing, [responder], {
    now: "2026-09-19T10:00:00.000Z",
    radiusKm: distance - 0.01,
    travelSpeedKmh: 100
  });

  assert.equal(matches.length, 0);
});

test("expired listings are rejected", () => {
  const listing = mockListing({
    pickupDeadline: "2026-09-19T09:00:00.000Z"
  });
  const responder = mockResponder();
  const matches = rankResponders(listing, [responder], {
    now: "2026-09-19T10:00:00.000Z"
  });
  assert.equal(matches.length, 0);
});

test("listings whose deadline equals the injected current time are rejected", () => {
  const exactTime = "2026-09-19T10:00:00.000Z";
  const listing = mockListing({
    pickupDeadline: exactTime
  });
  const responder = mockResponder();
  const matches = rankResponders(listing, [responder], {
    now: exactTime
  });
  assert.equal(matches.length, 0);
});

test("travel time exactly equal to the remaining pickup window is accepted", () => {
  const listing = mockListing({
    latitude: 12.9352,
    longitude: 77.6245,
    pickupDeadline: "2026-09-19T11:00:00.000Z" // 1 hour window from 10:00
  });
  const responder = mockResponder({
    latitude: 12.9784,
    longitude: 77.6408
  });
  const distance = haversineDistanceKm(
    { latitude: listing.latitude, longitude: listing.longitude },
    { latitude: responder.latitude, longitude: responder.longitude }
  );

  // With 1 hour remaining window (remainingHours = 1), setting travelSpeedKmh = distance
  // makes travelTime = distance / travelSpeedKmh = 1.0 hours == remainingHours
  const matches = rankResponders(listing, [responder], {
    now: "2026-09-19T10:00:00.000Z",
    radiusKm: 50,
    travelSpeedKmh: distance
  });

  assert.equal(matches.length, 1);
  assert.equal(matches[0]!.responder.id, responder.id);
});

test("travel time greater than the remaining window is rejected", () => {
  const listing = mockListing({
    latitude: 12.9352,
    longitude: 77.6245,
    pickupDeadline: "2026-09-19T11:00:00.000Z" // 1 hour window from 10:00
  });
  const responder = mockResponder({
    latitude: 12.9784,
    longitude: 77.6408
  });
  const distance = haversineDistanceKm(
    { latitude: listing.latitude, longitude: listing.longitude },
    { latitude: responder.latitude, longitude: responder.longitude }
  );

  // Set travelSpeedKmh slightly lower than distance, so travelTime > 1.0 hours
  const matches = rankResponders(listing, [responder], {
    now: "2026-09-19T10:00:00.000Z",
    radiusKm: 50,
    travelSpeedKmh: distance - 0.5
  });

  assert.equal(matches.length, 0);
});

test("deterministic now, radiusKm, and travelSpeedKmh options work", () => {
  const listing = mockListing({
    latitude: 12.9352,
    longitude: 77.6245,
    pickupDeadline: "2026-09-19T12:00:00.000Z"
  });
  const responder = mockResponder({
    latitude: 12.9500,
    longitude: 77.6300
  });
  const distance = haversineDistanceKm(
    { latitude: listing.latitude, longitude: listing.longitude },
    { latitude: responder.latitude, longitude: responder.longitude }
  );

  // Test custom now, radiusKm, and travelSpeedKmh
  const matches = rankResponders(listing, [responder], {
    now: new Date("2026-09-19T11:00:00.000Z"),
    radiusKm: distance + 1,
    travelSpeedKmh: 40
  });

  assert.equal(matches.length, 1);
  assert.equal(matches[0]!.distanceKm, distance);
  assert.equal(matches[0]!.capacityFit, 40); // 50 - 10
});

test("default radius remains 10 km and default travel speed remains 20 km/h", () => {
  const now = new Date("2026-09-19T10:00:00.000Z");
  // Listing at origin (0, 0)
  const listing = mockListing({
    latitude: 0,
    longitude: 0,
    // 30 min window (0.5 hour): at default 20 km/h, max reachable distance is 10 km
    pickupDeadline: new Date(now.getTime() + 30 * 60_000).toISOString()
  });

  // Calculate coordinates for distances: 9 km, 9.9 km, 10.1 km
  // dLat in degrees = (d / 6371) * (180 / PI)
  const latForDist = (d: number) => (d / 6371) * (180 / Math.PI);

  const withinDefault = mockResponder({
    id: "within-default",
    latitude: latForDist(9.0),
    longitude: 0
  });

  const outsideRadius = mockResponder({
    id: "outside-radius",
    latitude: latForDist(10.5),
    longitude: 0
  });

  // Call with no options (defaults radius = 10, speed = 20, now = Date.now())
  // To avoid wall-clock dependency, pass only `now` option
  const matches = rankResponders(listing, [withinDefault, outsideRadius], { now });

  assert.equal(matches.length, 1);
  assert.equal(matches[0]!.responder.id, "within-default");

  // Verify speed default of 20 km/h:
  // If window is 15 minutes (0.25 hours), reachable distance at 20 km/h is 5 km.
  // The 9 km responder will be rejected even though within 10 km radius.
  const shortDeadlineListing = mockListing({
    latitude: 0,
    longitude: 0,
    pickupDeadline: new Date(now.getTime() + 15 * 60_000).toISOString()
  });
  const shortMatches = rankResponders(shortDeadlineListing, [withinDefault], { now });
  assert.equal(shortMatches.length, 0);
});

test("ranking remains deterministic by distance and capacity fit", () => {
  const listing = mockListing({
    latitude: 12.9352,
    longitude: 77.6245,
    quantityMeals: 20
  });

  // 3 responders at different distances and capacities
  // r1: 1 km away, capacity 30 (capacityFit = 10)
  // r2: 1 km away, capacity 25 (capacityFit = 5) -> same distance as r1, but tighter fit!
  // r3: 0.5 km away, capacity 50 (capacityFit = 30) -> closer than r1 and r2!
  const r3 = mockResponder({
    id: "r3-closest",
    latitude: 12.9370,
    longitude: 77.6250,
    capacityMeals: 50
  });

  const r1 = mockResponder({
    id: "r1-same-dist-larger-fit",
    latitude: 12.9440,
    longitude: 77.6245,
    capacityMeals: 30
  });

  // Symmetric location so distance is identical to r1
  const r2 = mockResponder({
    id: "r2-same-dist-tighter-fit",
    latitude: 12.9440,
    longitude: 77.6245,
    capacityMeals: 25
  });

  // Provide in mixed order
  const matches = rankResponders(listing, [r1, r3, r2], {
    now: "2026-09-19T10:00:00.000Z",
    radiusKm: 10,
    travelSpeedKmh: 50
  });

  assert.equal(matches.length, 3);
  assert.equal(matches[0]!.responder.id, "r3-closest");
  assert.equal(matches[1]!.responder.id, "r2-same-dist-tighter-fit");
  assert.equal(matches[2]!.responder.id, "r1-same-dist-larger-fit");
});
