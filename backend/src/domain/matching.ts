import type { ResponderProfile, SurplusListing } from "@rescue-radius/shared";
import { haversineDistanceKm } from "./distance.js";

export type ResponderMatch = {
  responder: ResponderProfile;
  distanceKm: number;
  capacityFit: number;
};

type MatchingOptions = {
  radiusKm?: number;
  now?: Date | string | number;
  travelSpeedKmh?: number;
};

const DEFAULT_RADIUS_KM = 10;
const DEFAULT_TRAVEL_SPEED_KMH = 20;
const MS_PER_HOUR = 60 * 60 * 1_000;

function timestamp(value: Date | string | number | undefined): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return new Date(value ?? Date.now()).getTime();
}

function validCoordinate(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180;
}

function foodCompatible(listing: SurplusListing, responder: ResponderProfile): boolean {
  return responder.foodPreferences.includes(listing.foodCategory);
}

export function rankResponders(
  listing: SurplusListing,
  responders: ResponderProfile[],
  optionsOrRadius: MatchingOptions | number = {}
): ResponderMatch[] {
  // Keep accepting the old numeric radius argument while allowing callers to
  // freeze the clock and travel-speed assumption for deterministic matching.
  const options = typeof optionsOrRadius === "number"
    ? { radiusKm: optionsOrRadius }
    : optionsOrRadius;
  const radiusKm = options.radiusKm ?? DEFAULT_RADIUS_KM;
  const travelSpeedKmh = options.travelSpeedKmh ?? DEFAULT_TRAVEL_SPEED_KMH;
  const nowMs = timestamp(options.now);
  const deadlineMs = timestamp(listing.pickupDeadline);

  if (!Number.isFinite(radiusKm) || radiusKm < 0 ||
      !Number.isFinite(travelSpeedKmh) || travelSpeedKmh <= 0 ||
      !Number.isFinite(nowMs) || !Number.isFinite(deadlineMs) ||
      deadlineMs <= nowMs ||
      !validCoordinate(listing.latitude, listing.longitude) ||
      !Number.isFinite(listing.quantityMeals) || listing.quantityMeals <= 0) {
    return [];
  }

  const remainingHours = (deadlineMs - nowMs) / MS_PER_HOUR;

  return responders
    .filter((responder) => responder.verified)
    .filter((responder) => validCoordinate(responder.latitude, responder.longitude))
    .filter((responder) => Number.isFinite(responder.capacityMeals) && responder.capacityMeals >= 0)
    .filter((responder) => responder.capacityMeals >= listing.quantityMeals)
    .filter((responder) => foodCompatible(listing, responder))
    .map((responder) => {
      const distanceKm = haversineDistanceKm(
        { latitude: listing.latitude, longitude: listing.longitude },
        { latitude: responder.latitude, longitude: responder.longitude }
      );
      return {
        responder,
        distanceKm,
        capacityFit: responder.capacityMeals - listing.quantityMeals
      };
    })
    .filter((match) => Number.isFinite(match.distanceKm) && match.distanceKm <= radiusKm)
    .filter((match) => match.distanceKm / travelSpeedKmh <= remainingHours)
    .sort((a, b) => a.distanceKm - b.distanceKm || a.capacityFit - b.capacityFit);
}
