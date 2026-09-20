import type {
  CreateListingRequest,
  ImpactDashboard,
  ResponderProfile,
  SurplusListing
} from "../../shared/src/types.js";

export const DEMO_RESPONDERS: ResponderProfile[] = [
  {
    id: "responder-001",
    name: "Hope Kitchen NGO",
    role: "NGO",
    latitude: 12.9352,
    longitude: 77.6245,
    capacityMeals: 50,
    foodPreferences: ["VEG", "PACKAGED"],
    verified: true
  },
  {
    id: "responder-002",
    name: "Green Route Volunteers",
    role: "VOLUNTEER",
    latitude: 12.946,
    longitude: 77.61,
    capacityMeals: 25,
    foodPreferences: ["VEG", "NON_VEG", "PACKAGED"],
    verified: true
  },
  {
    id: "responder-003",
    name: "Neighbourhood Aid",
    role: "NGO",
    latitude: 13.02,
    longitude: 77.64,
    capacityMeals: 10,
    foodPreferences: ["VEG"],
    verified: true
  }
];

export const DEMO_RESTAURANTS = [
  { id: "restaurant-001", name: "Koramangala Kitchen", latitude: 12.9352, longitude: 77.6245, area: "Koramangala 5th Block" },
  { id: "restaurant-002", name: "Indiranagar Bakes", latitude: 12.9784, longitude: 77.6408, area: "Indiranagar 100ft Rd" },
  { id: "restaurant-003", name: "HSR Community Cafe", latitude: 12.9116, longitude: 77.6389, area: "HSR Sector 2" },
  { id: "restaurant-004", name: "Jayanagar Meals", latitude: 12.925, longitude: 77.5938, area: "Jayanagar 4th Block" },
  { id: "restaurant-005", name: "Whitefield Caterers", latitude: 12.9698, longitude: 77.7499, area: "Whitefield ITPL Rd" }
];

export const DEFAULT_RESPONDER: ResponderProfile = DEMO_RESPONDERS[0] ?? {
  id: "responder-001",
  name: "Hope Kitchen NGO",
  role: "NGO",
  latitude: 12.9352,
  longitude: 77.6245,
  capacityMeals: 50,
  foodPreferences: ["VEG", "PACKAGED"],
  verified: true
};

export const DEFAULT_RESTAURANT = DEMO_RESTAURANTS[0] ?? {
  id: "restaurant-001",
  name: "Koramangala Kitchen",
  latitude: 12.9352,
  longitude: 77.6245,
  area: "Koramangala 5th Block"
};


function initSeedListings(): SurplusListing[] {
  const now = Date.now();
  return [
    {
      id: "listing-001",
      restaurantId: "restaurant-001",
      restaurantName: "Koramangala Kitchen",
      foodDescription: "Packed rice and dal meals",
      quantityMeals: 30,
      quantityRaw: "4kg rice, 3L dal, 2L sambar",
      quantityUnit: "packs",
      foodCategory: "VEG",
      latitude: 12.9352,
      longitude: 77.6245,
      packedAt: new Date(now - 8 * 60_000).toISOString(),
      pickupDeadline: new Date(now + 42 * 60_000).toISOString(),
      status: "AVAILABLE",
      createdAt: new Date(now - 8 * 60_000).toISOString(),
      statusHistory: [
        {
          from: null,
          to: "AVAILABLE",
          actorId: "restaurant-001",
          timestamp: new Date(now - 8 * 60_000).toISOString()
        }
      ]
    },
    {
      id: "listing-002",
      restaurantId: "restaurant-002",
      restaurantName: "Indiranagar Bakes",
      foodDescription: "Fresh bakery sourdough & croissants",
      quantityMeals: 14,
      quantityRaw: "8 sourdough loaves, 12 croissants, 6 muffins",
      quantityUnit: "pieces",
      foodCategory: "PACKAGED",
      latitude: 12.9784,
      longitude: 77.6408,
      packedAt: new Date(now - 15 * 60_000).toISOString(),
      pickupDeadline: new Date(now + 55 * 60_000).toISOString(),
      status: "AVAILABLE",
      createdAt: new Date(now - 15 * 60_000).toISOString(),
      statusHistory: [
        {
          from: null,
          to: "AVAILABLE",
          actorId: "restaurant-002",
          timestamp: new Date(now - 15 * 60_000).toISOString()
        }
      ]
    },
    {
      id: "listing-003",
      restaurantId: "restaurant-003",
      restaurantName: "HSR Community Cafe",
      foodDescription: "Vegetable pulao & raita boxes",
      quantityMeals: 20,
      quantityRaw: "5kg veg pulao, 2L raita",
      quantityUnit: "boxes",
      foodCategory: "VEG",
      latitude: 12.9116,
      longitude: 77.6389,
      packedAt: new Date(now - 30 * 60_000).toISOString(),
      pickupDeadline: new Date(now + 18 * 60_000).toISOString(),
      status: "AVAILABLE",
      createdAt: new Date(now - 30 * 60_000).toISOString(),
      statusHistory: [
        {
          from: null,
          to: "AVAILABLE",
          actorId: "restaurant-003",
          timestamp: new Date(now - 30 * 60_000).toISOString()
        }
      ]
    },
    {
      id: "listing-004",
      restaurantId: "restaurant-004",
      restaurantName: "Jayanagar Meals",
      foodDescription: "Chicken biryani & curry trays",
      quantityMeals: 18,
      quantityRaw: "4kg chicken biryani, 2L curry, 1kg raita",
      quantityUnit: "trays",
      foodCategory: "NON_VEG",
      latitude: 12.925,
      longitude: 77.5938,
      packedAt: new Date(now - 12 * 60_000).toISOString(),
      pickupDeadline: new Date(now + 38 * 60_000).toISOString(),
      status: "CLAIMED",
      claimedBy: "responder-002",
      claimedAt: new Date(now - 4 * 60_000).toISOString(),
      createdAt: new Date(now - 12 * 60_000).toISOString(),
      statusHistory: [
        {
          from: null,
          to: "AVAILABLE",
          actorId: "restaurant-004",
          timestamp: new Date(now - 12 * 60_000).toISOString()
        },
        {
          from: "AVAILABLE",
          to: "CLAIMED",
          actorId: "responder-002",
          timestamp: new Date(now - 4 * 60_000).toISOString()
        }
      ]
    },
    {
      id: "listing-005",
      restaurantId: "restaurant-005",
      restaurantName: "Whitefield Caterers",
      foodDescription: "Corporate buffet surplus — Chapati & Paneer Sabzi",
      quantityMeals: 45,
      quantityRaw: "80 chapatis, 5L paneer butter masala, 3kg jeera rice, 2L dal",
      quantityUnit: "trays",
      foodCategory: "VEG",
      latitude: 12.9698,
      longitude: 77.7499,
      packedAt: new Date(now - 30 * 60_000).toISOString(),
      pickupDeadline: new Date(now + 75 * 60_000).toISOString(),
      status: "PICKED_UP",
      claimedBy: "responder-001",
      claimedAt: new Date(now - 22 * 60_000).toISOString(),
      createdAt: new Date(now - 30 * 60_000).toISOString(),
      statusHistory: [
        {
          from: null,
          to: "AVAILABLE",
          actorId: "restaurant-005",
          timestamp: new Date(now - 30 * 60_000).toISOString()
        },
        {
          from: "AVAILABLE",
          to: "CLAIMED",
          actorId: "responder-001",
          timestamp: new Date(now - 22 * 60_000).toISOString()
        },
        {
          from: "CLAIMED",
          to: "PICKED_UP",
          actorId: "responder-001",
          timestamp: new Date(now - 5 * 60_000).toISOString()
        }
      ]
    },
    {
      id: "listing-006",
      restaurantId: "restaurant-001",
      restaurantName: "Koramangala Kitchen",
      foodDescription: "South Indian tiffin breakfast pack",
      quantityMeals: 24,
      quantityRaw: "48 idlis, 3L sambar, 1L coconut chutney, 12 vadas",
      quantityUnit: "packs",
      foodCategory: "VEG",
      latitude: 12.9352,
      longitude: 77.6245,
      packedAt: new Date(now - 120 * 60_000).toISOString(),
      pickupDeadline: new Date(now - 10 * 60_000).toISOString(),
      status: "DELIVERED",
      claimedBy: "responder-001",
      claimedAt: new Date(now - 100 * 60_000).toISOString(),
      createdAt: new Date(now - 120 * 60_000).toISOString(),
      statusHistory: [
        {
          from: null,
          to: "AVAILABLE",
          actorId: "restaurant-001",
          timestamp: new Date(now - 120 * 60_000).toISOString()
        },
        {
          from: "AVAILABLE",
          to: "CLAIMED",
          actorId: "responder-001",
          timestamp: new Date(now - 100 * 60_000).toISOString()
        },
        {
          from: "CLAIMED",
          to: "PICKED_UP",
          actorId: "responder-001",
          timestamp: new Date(now - 70 * 60_000).toISOString()
        },
        {
          from: "PICKED_UP",
          to: "DELIVERED",
          actorId: "responder-001",
          timestamp: new Date(now - 40 * 60_000).toISOString()
        }
      ]
    }
  ];
}

let mockStore: SurplusListing[] = initSeedListings();

export function resetMockData(): void {
  mockStore = initSeedListings();
}

export function mockListings(): SurplusListing[] {
  const currentIso = new Date().toISOString();
  // Auto-expire listings whose deadline passed and are still AVAILABLE
  mockStore.forEach((l) => {
    if (l.status === "AVAILABLE" && l.pickupDeadline <= currentIso) {
      l.status = "EXPIRED";
      l.statusHistory.push({
        from: "AVAILABLE",
        to: "EXPIRED",
        actorId: "system",
        timestamp: currentIso,
        reason: "Pickup deadline exceeded"
      });
    }
  });

  return [...mockStore];
}

export function mockCreateListing(input: CreateListingRequest): SurplusListing {
  const nowIso = new Date().toISOString();
  const newListing: SurplusListing = {
    id: `listing-${Date.now().toString(36)}`,
    restaurantId: input.restaurantId,
    restaurantName: input.restaurantName,
    foodDescription: input.foodDescription,
    quantityMeals: input.quantityMeals,
    quantityRaw: input.quantityRaw,
    quantityUnit: input.quantityUnit,
    foodCategory: input.foodCategory,
    latitude: input.latitude,
    longitude: input.longitude,
    packedAt: input.packedAt,
    pickupDeadline: input.pickupDeadline,
    status: "AVAILABLE",
    createdAt: nowIso,
    statusHistory: [
      {
        from: null,
        to: "AVAILABLE",
        actorId: input.restaurantId,
        timestamp: nowIso
      }
    ]
  };

  mockStore = [newListing, ...mockStore];
  return newListing;
}

export function mockClaimListing(id: string, actorId: string, partialQty?: number): SurplusListing {
  const listing = mockStore.find((l) => l.id === id);
  if (!listing) {
    throw new Error("Listing not found");
  }

  const nowIso = new Date().toISOString();
  if (listing.pickupDeadline <= nowIso) {
    listing.status = "EXPIRED";
    throw new Error("Listing has expired and cannot be claimed");
  }

  if (listing.status !== "AVAILABLE") {
    const claimedByInfo = listing.claimedBy ? `claimed by ${listing.claimedBy}` : `in ${listing.status} state`;
    throw new Error(`Claim conflict: Listing is no longer available (${claimedByInfo})`);
  }

  // Support partial meal claiming (conditional decrement)
  if (partialQty && partialQty > 0 && partialQty < listing.quantityMeals) {
    const remainingMeals = listing.quantityMeals - partialQty;
    listing.quantityMeals = remainingMeals; // leaves remainder available

    const claimedListing: SurplusListing = {
      ...listing,
      id: `listing-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      quantityMeals: partialQty,
      status: "CLAIMED",
      claimedBy: actorId,
      claimedAt: nowIso,
      statusHistory: [
        ...listing.statusHistory,
        {
          from: "AVAILABLE",
          to: "CLAIMED",
          actorId,
          timestamp: nowIso
        }
      ]
    };
    mockStore.unshift(claimedListing);
    return claimedListing;
  }

  listing.status = "CLAIMED";
  listing.claimedBy = actorId;
  listing.claimedAt = nowIso;
  listing.statusHistory.push({
    from: "AVAILABLE",
    to: "CLAIMED",
    actorId,
    timestamp: nowIso
  });

  return listing;
}

export function mockCancelListing(id: string, actorId: string): SurplusListing {
  const listing = mockStore.find((l) => l.id === id);
  if (!listing) throw new Error("Listing not found");

  if (listing.status !== "CLAIMED") {
    throw new Error("Only claimed listings can be cancelled");
  }

  if (listing.claimedBy && listing.claimedBy !== actorId) {
    throw new Error("Only the assigned responder can cancel this claim");
  }

  const nowIso = new Date().toISOString();
  const timeRemaining = new Date(listing.pickupDeadline).getTime() - Date.now();

  // If time still remains (> 5 mins), return to AVAILABLE for reassignment, else mark CANCELLED
  const nextStatus = timeRemaining > 5 * 60_000 ? "AVAILABLE" : "CANCELLED";

  listing.status = nextStatus;
  listing.statusHistory.push({
    from: "CLAIMED",
    to: nextStatus,
    actorId,
    timestamp: nowIso,
    reason: "Claim cancelled by responder"
  });

  if (nextStatus === "AVAILABLE") {
    listing.claimedBy = undefined;
    listing.claimedAt = undefined;
  }

  return listing;
}

export function mockPickupListing(id: string, actorId: string): SurplusListing {
  const listing = mockStore.find((l) => l.id === id);
  if (!listing) throw new Error("Listing not found");

  if (listing.status !== "CLAIMED") {
    throw new Error("Listing must be in CLAIMED state to confirm pickup");
  }

  if (listing.claimedBy && listing.claimedBy !== actorId) {
    throw new Error("Only the assigned responder can confirm pickup");
  }

  const nowIso = new Date().toISOString();
  listing.status = "PICKED_UP";
  listing.statusHistory.push({
    from: "CLAIMED",
    to: "PICKED_UP",
    actorId,
    timestamp: nowIso
  });

  return listing;
}

export function mockDeliverListing(id: string, actorId: string): SurplusListing {
  const listing = mockStore.find((l) => l.id === id);
  if (!listing) throw new Error("Listing not found");

  if (listing.status !== "PICKED_UP") {
    throw new Error("Listing must be PICKED_UP before confirming delivery");
  }

  if (listing.claimedBy && listing.claimedBy !== actorId) {
    throw new Error("Only the assigned responder can confirm delivery");
  }

  const nowIso = new Date().toISOString();
  listing.status = "DELIVERED";
  listing.statusHistory.push({
    from: "PICKED_UP",
    to: "DELIVERED",
    actorId,
    timestamp: nowIso
  });

  return listing;
}

export function mockGetDashboard(): ImpactDashboard {
  const listings = mockStore;
  const currentIso = new Date().toISOString();

  const claimDurations = listings.flatMap((l) => {
    const claimedEvent = l.statusHistory.find((ev) => ev.to === "CLAIMED");
    if (!claimedEvent) return [];
    return [(new Date(claimedEvent.timestamp).getTime() - new Date(l.createdAt).getTime()) / 60_000];
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
      (l) => l.status === "EXPIRED" || (l.status === "AVAILABLE" && l.pickupDeadline <= currentIso)
    ).length,
    averageTimeToClaimMinutes: claimDurations.length
      ? Math.round((claimDurations.reduce((sum, val) => sum + val, 0) / claimDurations.length) * 10) / 10
      : 4.5,
    pickupSuccessRate: claimedCount ? Math.round((pickedUpCount / claimedCount) * 100) / 100 : 0.92
  };
}

