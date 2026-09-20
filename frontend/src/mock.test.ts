import { beforeEach, describe, expect, it } from "vitest";
import {
  mockCancelListing,
  mockClaimListing,
  mockGetListings,
  mockGetMyListings,
  mockPickupListing,
  resetMockStore
} from "./mock.js";

describe("demo adapter contract", () => {
  beforeEach(() => resetMockStore());

  it("returns only available, non-expired listings in deadline order", async () => {
    const listings = await mockGetListings({});
    expect(listings.length).toBeGreaterThan(0);
    expect(listings.every((listing) => listing.status === "AVAILABLE")).toBe(true);
    expect(listings.map((listing) => listing.pickupDeadline)).toEqual(
      [...listings].map((listing) => listing.pickupDeadline).sort()
    );
  });

  it("claims the complete listing and gives the responder a personal task", async () => {
    const available = await mockGetListings({});
    const target = available[0]!;
    const claimed = await mockClaimListing(target.id, "responder-001");
    const mine = await mockGetMyListings("responder-001");

    expect(claimed.quantityMeals).toBe(target.quantityMeals);
    expect(claimed.status).toBe("CLAIMED");
    expect(mine.some((listing) => listing.id === target.id)).toBe(true);
    await expect(mockClaimListing(target.id, "responder-002")).rejects.toThrow(/already claimed/i);
  });

  it("enforces actor-owned lifecycle transitions and terminal cancellation", async () => {
    const target = (await mockGetListings({}))[0]!;
    await mockClaimListing(target.id, "responder-001");
    await expect(mockPickupListing(target.id, "responder-002")).rejects.toThrow(/actor/i);
    const cancelled = await mockCancelListing(target.id, "responder-001");

    expect(cancelled.status).toBe("CANCELLED");
    expect((await mockGetListings({})).some((listing) => listing.id === target.id)).toBe(false);
  });
});
