export type Role = "RESTAURANT" | "RESPONDER" | "ADMIN";

export type ResponderRole = "NGO" | "VOLUNTEER";

export type ListingStatus =
  | "AVAILABLE"
  | "CLAIMED"
  | "PICKED_UP"
  | "DELIVERED"
  | "CANCELLED"
  | "EXPIRED";

export type FoodCategory = "VEG" | "NON_VEG" | "PACKAGED";

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type StatusEvent = {
  from: ListingStatus | null;
  to: ListingStatus;
  actorId: string;
  timestamp: string;
  reason?: string;
};

export type SurplusListing = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  foodDescription: string;
  quantityMeals: number;
  foodCategory: FoodCategory;
  latitude: number;
  longitude: number;
  packedAt: string;
  pickupDeadline: string;
  status: ListingStatus;
  claimedBy?: string;
  claimedAt?: string;
  createdAt: string;
  statusHistory: StatusEvent[];
};

export type ResponderProfile = {
  id: string;
  name: string;
  role: ResponderRole;
  latitude: number;
  longitude: number;
  capacityMeals: number;
  foodPreferences: FoodCategory[];
  verified: boolean;
};

export type CreateListingRequest = {
  restaurantId: string;
  restaurantName: string;
  foodDescription: string;
  quantityMeals: number;
  foodCategory: FoodCategory;
  latitude: number;
  longitude: number;
  packedAt: string;
  pickupDeadline: string;
};

export type ImpactDashboard = {
  totalMealsListed: number;
  mealsClaimed: number;
  mealsPickedUp: number;
  mealsDelivered: number;
  expiredListings: number;
  averageTimeToClaimMinutes: number;
  pickupSuccessRate: number;
};

export type ApiError = {
  error: string;
  message: string;
};
