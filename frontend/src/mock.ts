import type { SurplusListing } from "../../shared/src/types.js";

const now = Date.now();

let listings: SurplusListing[] = [
  {
    id: "listing-001",
    restaurantId: "restaurant-001",
    restaurantName: "Koramangala Kitchen",
    foodDescription: "Packed rice and dal meals",
    quantityMeals: 30,
    foodCategory: "VEG",
    latitude: 12.9352,
    longitude: 77.6245,
    packedAt: new Date(now - 5 * 60_000).toISOString(),
    pickupDeadline: new Date(now + 40 * 60_000).toISOString(),
    status: "AVAILABLE",
    createdAt: new Date(now - 5 * 60_000).toISOString(),
    statusHistory: []
  },
  {
    id: "listing-002",
    restaurantId: "restaurant-002",
    restaurantName: "Indiranagar Bakes",
    foodDescription: "Fresh bakery packs",
    quantityMeals: 12,
    foodCategory: "PACKAGED",
    latitude: 12.9784,
    longitude: 77.6408,
    packedAt: new Date(now - 10 * 60_000).toISOString(),
    pickupDeadline: new Date(now + 50 * 60_000).toISOString(),
    status: "AVAILABLE",
    createdAt: new Date(now - 10 * 60_000).toISOString(),
    statusHistory: []
  }
];

export function mockListings(): SurplusListing[] {
  const current = new Date().toISOString();
  return listings.filter((listing) => listing.pickupDeadline > current);
}

export function mockCreateListing(listing: Omit<SurplusListing, "id" | "createdAt" | "status" | "statusHistory">): SurplusListing {
  const nowIso = new Date().toISOString();
  const created: SurplusListing = {
    ...listing,
    id: `demo-${Date.now()}`,
    status: "AVAILABLE",
    createdAt: nowIso,
    statusHistory: []
  };
  listings = [created, ...listings];
  return created;
}

export function mockClaimListing(id: string, actorId: string): SurplusListing {
  const listing = listings.find((candidate) => candidate.id === id);
  if (!listing || listing.status !== "AVAILABLE") throw new Error("Listing is no longer available");
  listing.status = "CLAIMED";
  listing.claimedBy = actorId;
  listing.claimedAt = new Date().toISOString();
  return listing;
}
