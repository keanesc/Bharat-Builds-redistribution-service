import type { Role } from "./types.js";

export const API_ROUTES = {
  health: "/health",
  listings: "/listings",
  listingById: "/listings/:id",
  listingClaim: "/listings/:id/claim",
  listingStatus: "/listings/:id/:action",
  dashboard: "/dashboard/impact",
  profiles: "/profiles",
  profileById: "/profiles/:id",
  notifications: "/notifications/events"
} as const;

export const DEMO_ACTORS = {
  restaurant: "restaurant-001",
  responderA: "responder-001",
  responderB: "responder-002",
  admin: "admin-001"
} as const;

export const DEMO_ACTOR_ROLES: Record<string, Role> = {
  "restaurant-001": "RESTAURANT",
  "responder-001": "RESPONDER",
  "responder-002": "RESPONDER",
  "admin-001": "ADMIN"
};
