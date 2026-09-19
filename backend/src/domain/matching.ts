import type { ResponderProfile, SurplusListing } from "@rescue-radius/shared";
import { haversineDistanceKm } from "./distance.js";

export type ResponderMatch = {
  responder: ResponderProfile;
  distanceKm: number;
  capacityFit: number;
};

function foodCompatible(listing: SurplusListing, responder: ResponderProfile): boolean {
  return responder.foodPreferences.includes(listing.foodCategory);
}

export function rankResponders(
  listing: SurplusListing,
  responders: ResponderProfile[],
  radiusKm = 10
): ResponderMatch[] {
  return responders
    .filter((responder) => responder.verified)
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
    .filter((match) => match.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm || a.capacityFit - b.capacityFit);
}
