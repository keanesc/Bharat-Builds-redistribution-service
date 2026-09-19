import type { CreateListingRequest, ImpactDashboard, SurplusListing } from "../../shared/src/types.js";
import { API_ROUTES } from "../../shared/src/api-contracts.js";
import {
  mockCancelListing,
  mockClaimListing,
  mockCreateListing,
  mockDeliverListing,
  mockGetDashboard,
  mockListings,
  mockPickupListing
} from "./mock.js";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
const demoMode = import.meta.env.VITE_DEMO_MODE !== "false";

export { demoMode };

async function request<T>(path: string, actorId: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-demo-actor": actorId,
      ...(options?.headers ?? {})
    }
  });

  const body = (await response.json().catch(() => ({}))) as T & { message?: string; error?: string };
  if (!response.ok) {
    throw new Error(body.message || body.error || `Request failed with status ${response.status}`);
  }
  return body;
}

export async function getListings(actorId: string): Promise<SurplusListing[]> {
  if (demoMode) return mockListings();
  const response = await request<{ listings: SurplusListing[] }>(
    `${API_ROUTES.listings}?latitude=12.9352&longitude=77.6245&radiusKm=10`,
    actorId
  );
  return response.listings;
}

export async function createListing(actorId: string, input: CreateListingRequest): Promise<SurplusListing> {
  if (demoMode) {
    return mockCreateListing(input);
  }
  return request<SurplusListing>(API_ROUTES.listings, actorId, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function claimListing(actorId: string, listingId: string, quantity?: number): Promise<SurplusListing> {
  if (demoMode) return mockClaimListing(listingId, actorId, quantity);
  return request<SurplusListing>(`${API_ROUTES.listings}/${listingId}/claim`, actorId, {
    method: "POST",
    body: quantity ? JSON.stringify({ quantity }) : undefined
  });
}

export async function cancelListing(actorId: string, listingId: string): Promise<SurplusListing> {
  if (demoMode) return mockCancelListing(listingId, actorId);
  return request<SurplusListing>(`${API_ROUTES.listings}/${listingId}/cancel`, actorId, { method: "POST" });
}

export async function pickupListing(actorId: string, listingId: string): Promise<SurplusListing> {
  if (demoMode) return mockPickupListing(listingId, actorId);
  return request<SurplusListing>(`${API_ROUTES.listings}/${listingId}/pickup`, actorId, { method: "POST" });
}

export async function deliverListing(actorId: string, listingId: string): Promise<SurplusListing> {
  if (demoMode) return mockDeliverListing(listingId, actorId);
  return request<SurplusListing>(`${API_ROUTES.listings}/${listingId}/deliver`, actorId, { method: "POST" });
}

export async function getImpactDashboard(actorId: string): Promise<ImpactDashboard> {
  if (demoMode) return mockGetDashboard();
  return request<ImpactDashboard>(API_ROUTES.dashboard, actorId);
}

