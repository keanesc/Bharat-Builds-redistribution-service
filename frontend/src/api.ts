import type { CreateListingRequest, SurplusListing } from "../../shared/src/types.js";
import { mockClaimListing, mockCreateListing, mockListings } from "./mock.js";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
const demoMode = import.meta.env.VITE_DEMO_MODE !== "false";

async function request<T>(path: string, actorId: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-demo-actor": actorId,
      ...(options?.headers ?? {})
    }
  });

  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message ?? "Request failed");
  return body;
}

export async function getListings(actorId: string): Promise<SurplusListing[]> {
  if (demoMode) return mockListings();
  const response = await request<{ listings: SurplusListing[] }>("/listings?latitude=12.9352&longitude=77.6245&radiusKm=10", actorId);
  return response.listings;
}

export async function createListing(actorId: string, input: CreateListingRequest): Promise<SurplusListing> {
  if (demoMode) {
    return mockCreateListing(input);
  }
  return request<SurplusListing>("/listings", actorId, { method: "POST", body: JSON.stringify(input) });
}

export async function claimListing(actorId: string, listingId: string): Promise<SurplusListing> {
  if (demoMode) return mockClaimListing(listingId, actorId);
  return request<SurplusListing>(`/listings/${listingId}/claim`, actorId, { method: "POST" });
}
