import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { SurplusListing, ImpactDashboard } from "@rescue-radius/shared";
import { db, listingsTable } from "../lib/db.js";
import { internalError, json } from "../lib/http.js";

export const handler: APIGatewayProxyHandlerV2 = async () => {
  try {
    const result = await db.send(new ScanCommand({ TableName: listingsTable }));
    const listings = (result.Items as SurplusListing[] | undefined) ?? [];
    const claimDurations = listings.flatMap((listing) => {
      const claimed = listing.statusHistory.find((event) => event.to === "CLAIMED");
      if (!claimed) return [];
      return [(new Date(claimed.timestamp).getTime() - new Date(listing.createdAt).getTime()) / 60000];
    });
    const claimedCount = listings.filter((listing) => ["CLAIMED", "PICKED_UP", "DELIVERED"].includes(listing.status)).length;
    const pickedUpCount = listings.filter((listing) => ["PICKED_UP", "DELIVERED"].includes(listing.status)).length;
    const dashboard: ImpactDashboard = {
      totalMealsListed: listings.reduce((sum, listing) => sum + listing.quantityMeals, 0),
      mealsClaimed: listings.filter((listing) => ["CLAIMED", "PICKED_UP", "DELIVERED"].includes(listing.status)).reduce((sum, listing) => sum + listing.quantityMeals, 0),
      mealsPickedUp: listings.filter((listing) => ["PICKED_UP", "DELIVERED"].includes(listing.status)).reduce((sum, listing) => sum + listing.quantityMeals, 0),
      mealsDelivered: listings.filter((listing) => listing.status === "DELIVERED").reduce((sum, listing) => sum + listing.quantityMeals, 0),
      expiredListings: listings.filter((listing) => listing.status === "EXPIRED" || (listing.status === "AVAILABLE" && listing.pickupDeadline <= new Date().toISOString())).length,
      averageTimeToClaimMinutes: claimDurations.length ? claimDurations.reduce((sum, value) => sum + value, 0) / claimDurations.length : 0,
      pickupSuccessRate: claimedCount ? pickedUpCount / claimedCount : 0
    };
    return json(200, dashboard);
  } catch (error) {
    return internalError(error);
  }
};
