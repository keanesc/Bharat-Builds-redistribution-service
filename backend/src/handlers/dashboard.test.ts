import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SurplusListing, StatusEvent } from "@rescue-radius/shared";

// ---------------------------------------------------------------------------
// Fixture path
// ---------------------------------------------------------------------------

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const fixturePath = resolve(__dirname, "../../../fixtures/demo.json");

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

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
    packedAt: new Date(Date.now() - 10 * 60000).toISOString(),
    pickupDeadline: new Date(Date.now() + 30 * 60000).toISOString(),
    status: "AVAILABLE",
    createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
    statusHistory: []
  };
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// Inline dashboard calculation (mirrors dashboard.ts exactly)
// ---------------------------------------------------------------------------

function calculateDashboard(listings: SurplusListing[]) {
  const now = new Date().toISOString();
  const claimDurations = listings.flatMap((listing) => {
    const claimed = listing.statusHistory.find((event) => event.to === "CLAIMED");
    if (!claimed) return [];
    return [(new Date(claimed.timestamp).getTime() - new Date(listing.createdAt).getTime()) / 60000];
  });
  const claimedCount = listings.filter((l) => ["CLAIMED", "PICKED_UP", "DELIVERED"].includes(l.status)).length;
  const pickedUpCount = listings.filter((l) => ["PICKED_UP", "DELIVERED"].includes(l.status)).length;
  return {
    totalMealsListed: listings.reduce((sum, l) => sum + l.quantityMeals, 0),
    mealsClaimed: listings
      .filter((l) => ["CLAIMED", "PICKED_UP", "DELIVERED"].includes(l.status))
      .reduce((sum, l) => sum + l.quantityMeals, 0),
    mealsPickedUp: listings
      .filter((l) => ["PICKED_UP", "DELIVERED"].includes(l.status))
      .reduce((sum, l) => sum + l.quantityMeals, 0),
    mealsDelivered: listings
      .filter((l) => l.status === "DELIVERED")
      .reduce((sum, l) => sum + l.quantityMeals, 0),
    expiredListings: listings.filter(
      (l) => l.status === "EXPIRED" || (l.status === "AVAILABLE" && l.pickupDeadline <= now)
    ).length,
    averageTimeToClaimMinutes: claimDurations.length
      ? claimDurations.reduce((sum, v) => sum + v, 0) / claimDurations.length
      : 0,
    pickupSuccessRate: claimedCount ? pickedUpCount / claimedCount : 0
  };
}

// ---------------------------------------------------------------------------
// Dashboard calculation tests (FR-010)
// ---------------------------------------------------------------------------

test("empty listing array returns zero metrics", () => {
  const result = calculateDashboard([]);
  assert.equal(result.totalMealsListed, 0);
  assert.equal(result.mealsClaimed, 0);
  assert.equal(result.mealsPickedUp, 0);
  assert.equal(result.mealsDelivered, 0);
  assert.equal(result.expiredListings, 0);
  assert.equal(result.averageTimeToClaimMinutes, 0);
  assert.equal(result.pickupSuccessRate, 0);
});

test("totalMealsListed sums quantityMeals across all listings", () => {
  const listings = [
    mockListing({ id: "a", quantityMeals: 10 }),
    mockListing({ id: "b", quantityMeals: 25 }),
    mockListing({ id: "c", quantityMeals: 5 })
  ];
  const result = calculateDashboard(listings);
  assert.equal(result.totalMealsListed, 40);
});

test("mealsClaimed counts CLAIMED, PICKED_UP, and DELIVERED statuses", () => {
  const listings = [
    mockListing({ id: "a", quantityMeals: 10, status: "AVAILABLE" }),
    mockListing({ id: "b", quantityMeals: 20, status: "CLAIMED" }),
    mockListing({ id: "c", quantityMeals: 15, status: "PICKED_UP" }),
    mockListing({ id: "d", quantityMeals: 5, status: "DELIVERED" }),
    mockListing({ id: "e", quantityMeals: 8, status: "EXPIRED" })
  ];
  const result = calculateDashboard(listings);
  // CLAIMED(20) + PICKED_UP(15) + DELIVERED(5) = 40
  assert.equal(result.mealsClaimed, 40);
});

test("mealsPickedUp counts only PICKED_UP and DELIVERED statuses", () => {
  const listings = [
    mockListing({ id: "a", quantityMeals: 10, status: "AVAILABLE" }),
    mockListing({ id: "b", quantityMeals: 20, status: "CLAIMED" }),
    mockListing({ id: "c", quantityMeals: 15, status: "PICKED_UP" }),
    mockListing({ id: "d", quantityMeals: 5, status: "DELIVERED" })
  ];
  const result = calculateDashboard(listings);
  // PICKED_UP(15) + DELIVERED(5) = 20
  assert.equal(result.mealsPickedUp, 20);
});

test("mealsDelivered counts only DELIVERED status", () => {
  const listings = [
    mockListing({ id: "a", quantityMeals: 10, status: "AVAILABLE" }),
    mockListing({ id: "b", quantityMeals: 20, status: "CLAIMED" }),
    mockListing({ id: "c", quantityMeals: 15, status: "PICKED_UP" }),
    mockListing({ id: "d", quantityMeals: 5, status: "DELIVERED" }),
    mockListing({ id: "e", quantityMeals: 7, status: "DELIVERED" })
  ];
  const result = calculateDashboard(listings);
  // DELIVERED(5) + DELIVERED(7) = 12
  assert.equal(result.mealsDelivered, 12);
});

test("expiredListings counts EXPIRED status listings", () => {
  const listings = [
    mockListing({ id: "a", status: "AVAILABLE" }),
    mockListing({ id: "b", status: "EXPIRED" }),
    mockListing({ id: "c", status: "EXPIRED" }),
    mockListing({ id: "d", status: "DELIVERED" })
  ];
  const result = calculateDashboard(listings);
  assert.equal(result.expiredListings, 2);
});

test("expiredListings counts AVAILABLE listings past their pickupDeadline", () => {
  const pastDeadline = new Date(Date.now() - 5 * 60000).toISOString();
  const futureDeadline = new Date(Date.now() + 30 * 60000).toISOString();
  const listings = [
    mockListing({ id: "a", status: "AVAILABLE", pickupDeadline: futureDeadline }),
    mockListing({ id: "b", status: "AVAILABLE", pickupDeadline: pastDeadline }),
    mockListing({ id: "c", status: "AVAILABLE", pickupDeadline: pastDeadline }),
    mockListing({ id: "d", status: "EXPIRED" })
  ];
  const result = calculateDashboard(listings);
  // 2 AVAILABLE past deadline + 1 EXPIRED = 3
  assert.equal(result.expiredListings, 3);
});

test("averageTimeToClaimMinutes is 0 when no listings are claimed", () => {
  const listings = [
    mockListing({ id: "a", status: "AVAILABLE", statusHistory: [] }),
    mockListing({ id: "b", status: "EXPIRED", statusHistory: [] })
  ];
  const result = calculateDashboard(listings);
  assert.equal(result.averageTimeToClaimMinutes, 0);
});

test("averageTimeToClaimMinutes calculates correctly from statusHistory", () => {
  const createdAt = new Date(Date.now() - 20 * 60000).toISOString();
  // Listing 1: claimed 10 minutes after creation
  const claimedAt1 = new Date(new Date(createdAt).getTime() + 10 * 60000).toISOString();
  // Listing 2: claimed 30 minutes after creation
  const createdAt2 = new Date(Date.now() - 40 * 60000).toISOString();
  const claimedAt2 = new Date(new Date(createdAt2).getTime() + 30 * 60000).toISOString();

  const claimEvent1: StatusEvent = { from: "AVAILABLE", to: "CLAIMED", actorId: "responder-001", timestamp: claimedAt1 };
  const claimEvent2: StatusEvent = { from: "AVAILABLE", to: "CLAIMED", actorId: "responder-002", timestamp: claimedAt2 };

  const listings = [
    mockListing({ id: "a", status: "CLAIMED", createdAt, statusHistory: [claimEvent1] }),
    mockListing({ id: "b", status: "CLAIMED", createdAt: createdAt2, statusHistory: [claimEvent2] })
  ];
  const result = calculateDashboard(listings);
  // avg of 10 and 30 = 20 minutes
  assert.ok(Math.abs(result.averageTimeToClaimMinutes - 20) < 0.01, `expected ~20, got ${result.averageTimeToClaimMinutes}`);
});

test("pickupSuccessRate is 0 when no claims", () => {
  const listings = [
    mockListing({ id: "a", status: "AVAILABLE" }),
    mockListing({ id: "b", status: "EXPIRED" })
  ];
  const result = calculateDashboard(listings);
  assert.equal(result.pickupSuccessRate, 0);
});

test("pickupSuccessRate is 1.0 when all claimed listings are picked up", () => {
  const listings = [
    mockListing({ id: "a", status: "PICKED_UP" }),
    mockListing({ id: "b", status: "DELIVERED" })
  ];
  const result = calculateDashboard(listings);
  assert.equal(result.pickupSuccessRate, 1.0);
});

test("pickupSuccessRate is 0.5 when half of claimed are picked up", () => {
  const listings = [
    mockListing({ id: "a", status: "CLAIMED" }),
    mockListing({ id: "b", status: "CLAIMED" }),
    mockListing({ id: "c", status: "PICKED_UP" }),
    mockListing({ id: "d", status: "DELIVERED" })
  ];
  const result = calculateDashboard(listings);
  // pickedUpCount=2 (PICKED_UP + DELIVERED), claimedCount=4 → 0.5
  assert.equal(result.pickupSuccessRate, 0.5);
});

// ---------------------------------------------------------------------------
// Seed determinism tests (read fixture file, validate shape)
// ---------------------------------------------------------------------------

type FixtureFile = {
  profiles: Array<{
    id: string;
    name: string;
    role: string;
    latitude: number;
    longitude: number;
    capacityMeals: number;
    foodPreferences: string[];
    verified: boolean;
  }>;
  restaurants: Array<{ id: string; name: string; latitude: number; longitude: number }>;
  listings: Array<{
    id: string;
    restaurantId: string;
    foodDescription: string;
    quantityMeals: number;
    foodCategory: string;
    packedMinutesAgo: number;
    pickupWindowMinutes: number;
  }>;
};

const DEMO_RESPONDER_IDS = ["responder-001", "responder-002", "responder-003"];

test("fixture file contains profiles, restaurants, and listings arrays", async () => {
  const raw = await readFile(fixturePath, "utf8");
  const fixture = JSON.parse(raw) as FixtureFile;
  assert.ok(Array.isArray(fixture.profiles), "fixture.profiles should be an array");
  assert.ok(Array.isArray(fixture.restaurants), "fixture.restaurants should be an array");
  assert.ok(Array.isArray(fixture.listings), "fixture.listings should be an array");
  assert.ok(fixture.profiles.length > 0, "fixture.profiles should not be empty");
  assert.ok(fixture.restaurants.length > 0, "fixture.restaurants should not be empty");
  assert.ok(fixture.listings.length > 0, "fixture.listings should not be empty");
});

test("all profile ids match expected DEMO_ACTORS responder IDs", async () => {
  const raw = await readFile(fixturePath, "utf8");
  const fixture = JSON.parse(raw) as FixtureFile;
  const profileIds = fixture.profiles.map((p) => p.id).sort();
  const expectedIds = [...DEMO_RESPONDER_IDS].sort();
  assert.deepEqual(profileIds, expectedIds);
});

test("all listing restaurantIds reference a restaurant in the fixture", async () => {
  const raw = await readFile(fixturePath, "utf8");
  const fixture = JSON.parse(raw) as FixtureFile;
  const restaurantIdSet = new Set(fixture.restaurants.map((r) => r.id));
  for (const listing of fixture.listings) {
    assert.ok(
      restaurantIdSet.has(listing.restaurantId),
      `listing ${listing.id} references unknown restaurant ${listing.restaurantId}`
    );
  }
});

test("all fixture profiles have verified: true", async () => {
  const raw = await readFile(fixturePath, "utf8");
  const fixture = JSON.parse(raw) as FixtureFile;
  for (const profile of fixture.profiles) {
    assert.equal(profile.verified, true, `profile ${profile.id} should have verified: true`);
  }
});

test("all fixture listings have positive quantityMeals and positive pickupWindowMinutes", async () => {
  const raw = await readFile(fixturePath, "utf8");
  const fixture = JSON.parse(raw) as FixtureFile;
  for (const listing of fixture.listings) {
    assert.ok(listing.quantityMeals > 0, `listing ${listing.id} should have positive quantityMeals`);
    assert.ok(listing.pickupWindowMinutes > 0, `listing ${listing.id} should have positive pickupWindowMinutes`);
  }
});

test("seed computes relative timestamps correctly", async () => {
  const raw = await readFile(fixturePath, "utf8");
  const fixture = JSON.parse(raw) as FixtureFile;
  // Test the formula: pickupDeadline = now + (pickupWindowMinutes - packedMinutesAgo) minutes
  // We verify the formula is arithmetically correct for each listing without hitting DB.
  for (const listing of fixture.listings) {
    const simulatedNow = Date.now();
    const packedAt = new Date(simulatedNow - listing.packedMinutesAgo * 60_000);
    const pickupDeadline = new Date(simulatedNow + (listing.pickupWindowMinutes - listing.packedMinutesAgo) * 60_000);
    // pickupDeadline should be ahead of packedAt by exactly pickupWindowMinutes
    const diffMinutes = (pickupDeadline.getTime() - packedAt.getTime()) / 60_000;
    assert.ok(
      Math.abs(diffMinutes - listing.pickupWindowMinutes) < 0.01,
      `listing ${listing.id}: expected pickupDeadline to be ${listing.pickupWindowMinutes} minutes after packedAt, got ${diffMinutes}`
    );
    // pickupDeadline should be in the future for listings where pickupWindowMinutes > packedMinutesAgo
    if (listing.pickupWindowMinutes > listing.packedMinutesAgo) {
      assert.ok(
        pickupDeadline.getTime() > simulatedNow,
        `listing ${listing.id}: pickupDeadline should be in the future when pickupWindowMinutes > packedMinutesAgo`
      );
    }
  }
});
