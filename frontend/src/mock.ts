import type {
  CreateListingRequest,
  ImpactDashboard,
  ListingQueryParams,
  ListingStatus,
  ResponderProfile,
  Role,
  SurplusListing
} from "../../shared/src/types.js";
import { DEMO_ACTOR_ROLES } from "../../shared/src/api-contracts.js";

export const DEMO_RESPONDERS: ResponderProfile[] = [
  {
    id: "responder-001",
    name: "Hope Kitchen NGO",
    role: "NGO",
    latitude: 12.9352,
    longitude: 77.6245,
    capacityMeals: 50,
    foodPreferences: ["VEG", "PACKAGED"],
    verified: true,
    approvalStatus: "APPROVED"
  },
  {
    id: "responder-002",
    name: "Green Route Volunteers",
    role: "VOLUNTEER",
    latitude: 12.946,
    longitude: 77.61,
    capacityMeals: 25,
    foodPreferences: ["VEG", "NON_VEG", "PACKAGED"],
    verified: true,
    approvalStatus: "APPROVED"
  }
];

export const DEFAULT_RESPONDER = DEMO_RESPONDERS[0]!;
export const DEFAULT_RESTAURANT = {
  id: "restaurant-001",
  name: "Koramangala Kitchen",
  latitude: 12.9352,
  longitude: 77.6245,
  area: "Koramangala 5th Block"
};

function listing(input: Partial<SurplusListing> & Pick<SurplusListing, "id" | "restaurantId" | "restaurantName" | "foodDescription" | "quantityMeals" | "foodCategory" | "latitude" | "longitude">): SurplusListing {
  const now = Date.now();
  const createdAt = input.createdAt ?? new Date(now - 10 * 60_000).toISOString();
  return {
    packedAt: input.packedAt ?? createdAt,
    pickupDeadline: input.pickupDeadline ?? new Date(now + 50 * 60_000).toISOString(),
    status: input.status ?? "AVAILABLE",
    createdAt,
    statusHistory: input.statusHistory ?? [{ from: null, to: "AVAILABLE", actorId: input.restaurantId, timestamp: createdAt }],
    ...input
  };
}

function initialListings(): SurplusListing[] {
  const now = Date.now();
  return [
    listing({
      id: "listing-001",
      restaurantId: "restaurant-001",
      restaurantName: "Koramangala Kitchen",
      foodDescription: "Packed rice and dal meals",
      quantityMeals: 30,
      foodCategory: "VEG",
      latitude: 12.9352,
      longitude: 77.6245,
      pickupDeadline: new Date(now + 42 * 60_000).toISOString()
    }),
    listing({
      id: "listing-002",
      restaurantId: "restaurant-002",
      restaurantName: "Indiranagar Bakes",
      foodDescription: "Fresh bread and bakery packs",
      quantityMeals: 14,
      foodCategory: "PACKAGED",
      latitude: 12.9784,
      longitude: 77.6408,
      pickupDeadline: new Date(now + 55 * 60_000).toISOString()
    }),
    listing({
      id: "listing-003",
      restaurantId: "restaurant-003",
      restaurantName: "HSR Community Cafe",
      foodDescription: "Vegetable pulao and raita boxes",
      quantityMeals: 20,
      foodCategory: "VEG",
      latitude: 12.9116,
      longitude: 77.6389,
      pickupDeadline: new Date(now + 18 * 60_000).toISOString()
    }),
    listing({
      id: "listing-004",
      restaurantId: "restaurant-001",
      restaurantName: "Koramangala Kitchen",
      foodDescription: "South Indian breakfast packs",
      quantityMeals: 24,
      foodCategory: "VEG",
      latitude: 12.9352,
      longitude: 77.6245,
      status: "DELIVERED",
      claimedBy: "responder-001",
      claimedAt: new Date(now - 55 * 60_000).toISOString(),
      createdAt: new Date(now - 70 * 60_000).toISOString(),
      pickupDeadline: new Date(now - 10 * 60_000).toISOString(),
      statusHistory: [
        { from: null, to: "AVAILABLE", actorId: "restaurant-001", timestamp: new Date(now - 70 * 60_000).toISOString() },
        { from: "AVAILABLE", to: "CLAIMED", actorId: "responder-001", timestamp: new Date(now - 55 * 60_000).toISOString() },
        { from: "CLAIMED", to: "PICKED_UP", actorId: "responder-001", timestamp: new Date(now - 35 * 60_000).toISOString() },
        { from: "PICKED_UP", to: "DELIVERED", actorId: "responder-001", timestamp: new Date(now - 18 * 60_000).toISOString() }
      ]
    })
  ];
}

let store = initialListings();

export function resetMockStore(): void {
  store = initialListings();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function roleFor(actorId: string): Role {
  const role = DEMO_ACTOR_ROLES[actorId];
  if (!role) throw new Error("X-Demo-Actor must be a known demo actor ID");
  return role;
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadius = 6371;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function mockGetListings(params: ListingQueryParams): Promise<SurplusListing[]> {
  const now = Date.now();
  const originIsValid = Number.isFinite(params.latitude) && Number.isFinite(params.longitude);
  return clone(store
    .filter((item) => item.status === "AVAILABLE" && new Date(item.pickupDeadline).getTime() > now)
    .filter((item) => !params.foodCategory || item.foodCategory === params.foodCategory)
    .filter((item) => params.minQuantity === undefined || item.quantityMeals >= params.minQuantity)
    .filter((item) => params.maxMinutesUntilDeadline === undefined
      || (new Date(item.pickupDeadline).getTime() - now) / 60_000 <= params.maxMinutesUntilDeadline)
    .filter((item) => !params.restaurantId || item.restaurantId === params.restaurantId)
    .filter((item) => !originIsValid || distanceKm(
      params.latitude!,
      params.longitude!,
      item.latitude,
      item.longitude
    ) <= (params.radiusKm ?? 10))
    .sort((a, b) => a.pickupDeadline.localeCompare(b.pickupDeadline)));
}

export async function mockGetMyListings(actorId: string): Promise<SurplusListing[]> {
  const role = roleFor(actorId);
  if (role === "ADMIN") throw new Error("Admin actors do not have personal listings");
  return clone(store
    .filter((item) => role === "RESTAURANT" ? item.restaurantId === actorId : item.claimedBy === actorId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export async function mockGetProfiles(): Promise<ResponderProfile[]> {
  return clone(DEMO_RESPONDERS);
}

export async function mockGetProfile(profileId: string): Promise<ResponderProfile> {
  const profile = DEMO_RESPONDERS.find((item) => item.id === profileId);
  if (!profile) throw new Error("Profile not found");
  return clone(profile);
}

export async function mockCreateListing(actorId: string, input: CreateListingRequest): Promise<SurplusListing> {
  roleFor(actorId);
  const now = new Date().toISOString();
  const created: SurplusListing = {
    ...input,
    id: `listing-${crypto.randomUUID()}`,
    status: "AVAILABLE",
    createdAt: now,
    statusHistory: [{ from: null, to: "AVAILABLE", actorId, timestamp: now }]
  };
  store.unshift(created);
  return clone(created);
}

function transition(listingId: string, actorId: string, from: ListingStatus, to: ListingStatus): SurplusListing {
  const target = store.find((item) => item.id === listingId);
  if (!target || target.status !== from || target.claimedBy !== actorId) {
    throw new Error("Listing status or actor does not allow this transition");
  }
  const now = new Date().toISOString();
  target.status = to;
  target.statusHistory.push({ from, to, actorId, timestamp: now });
  return clone(target);
}

export async function mockClaimListing(listingId: string, actorId: string): Promise<SurplusListing> {
  if (roleFor(actorId) !== "RESPONDER") throw new Error("Only responders can claim listings");
  const target = store.find((item) => item.id === listingId);
  if (!target || target.status !== "AVAILABLE" || target.pickupDeadline <= new Date().toISOString()) {
    throw new Error("Listing is already claimed, cancelled, or expired");
  }
  const now = new Date().toISOString();
  target.status = "CLAIMED";
  target.claimedBy = actorId;
  target.claimedAt = now;
  target.statusHistory.push({ from: "AVAILABLE", to: "CLAIMED", actorId, timestamp: now });
  return clone(target);
}

export async function mockCancelListing(listingId: string, actorId: string): Promise<SurplusListing> {
  return transition(listingId, actorId, "CLAIMED", "CANCELLED");
}

export async function mockPickupListing(listingId: string, actorId: string): Promise<SurplusListing> {
  return transition(listingId, actorId, "CLAIMED", "PICKED_UP");
}

export async function mockDeliverListing(listingId: string, actorId: string): Promise<SurplusListing> {
  return transition(listingId, actorId, "PICKED_UP", "DELIVERED");
}

export async function mockGetDashboard(): Promise<ImpactDashboard> {
  const claimedStatuses: ListingStatus[] = ["CLAIMED", "PICKED_UP", "DELIVERED"];
  const pickedUpStatuses: ListingStatus[] = ["PICKED_UP", "DELIVERED"];
  const claimed = store.filter((item) => claimedStatuses.includes(item.status));
  const pickedUp = store.filter((item) => pickedUpStatuses.includes(item.status));
  const claimMinutes = store.flatMap((item) => {
    const event = item.statusHistory.find((entry) => entry.to === "CLAIMED");
    return event ? [(new Date(event.timestamp).getTime() - new Date(item.createdAt).getTime()) / 60_000] : [];
  });
  return {
    totalMealsListed: store.reduce((sum, item) => sum + item.quantityMeals, 0),
    mealsClaimed: claimed.reduce((sum, item) => sum + item.quantityMeals, 0),
    mealsPickedUp: pickedUp.reduce((sum, item) => sum + item.quantityMeals, 0),
    mealsDelivered: store.filter((item) => item.status === "DELIVERED").reduce((sum, item) => sum + item.quantityMeals, 0),
    expiredListings: store.filter((item) => item.status === "EXPIRED").length,
    averageTimeToClaimMinutes: claimMinutes.length
      ? claimMinutes.reduce((sum, minutes) => sum + minutes, 0) / claimMinutes.length
      : 0,
    pickupSuccessRate: claimed.length ? pickedUp.length / claimed.length : 0
  };
}
