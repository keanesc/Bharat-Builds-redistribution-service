import type {
  CreateListingRequest,
  ImpactDashboard,
  ListingQueryParams,
  ResponderProfile,
  SurplusListing
} from "../../shared/src/types.js";
import { API_ROUTES } from "../../shared/src/api-contracts.js";
import {
  mockCancelListing,
  mockClaimListing,
  mockCreateListing,
  mockDeliverListing,
  mockGetDashboard,
  mockGetListings,
  mockGetMyListings,
  mockGetProfile,
  mockGetProfiles,
  mockPickupListing
} from "./mock.js";

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";
const apiBaseUrl = configuredBaseUrl.replace(/\/$/, "");
export const demoMode = import.meta.env.VITE_DEMO_MODE === "true";

export class ApiClientError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

function requireApiBaseUrl(): string {
  if (!apiBaseUrl) {
    throw new ApiClientError(
      "VITE_API_BASE_URL is required when demo mode is disabled.",
      0,
      "CONFIGURATION_ERROR"
    );
  }
  return apiBaseUrl;
}

async function request<T>(
  path: string,
  actorId: string,
  options: RequestInit = {},
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(`${requireApiBaseUrl()}${path}`, {
    ...options,
    signal,
    headers: {
      "content-type": "application/json",
      "x-demo-actor": actorId,
      ...options.headers
    }
  });

  const body = (await response.json().catch(() => ({}))) as T & { message?: string; error?: string };
  if (!response.ok) {
    throw new ApiClientError(
      body.message || body.error || `Request failed with status ${response.status}`,
      response.status,
      body.error
    );
  }
  return body;
}

function listingsPath(params: ListingQueryParams): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `${API_ROUTES.listings}?${suffix}` : API_ROUTES.listings;
}

export async function getListings(
  actorId: string,
  params: ListingQueryParams,
  signal?: AbortSignal
): Promise<SurplusListing[]> {
  if (demoMode) return mockGetListings(params);
  const response = await request<{ listings: SurplusListing[] }>(listingsPath(params), actorId, {}, signal);
  return response.listings;
}

export async function getMyListings(actorId: string, signal?: AbortSignal): Promise<SurplusListing[]> {
  if (demoMode) return mockGetMyListings(actorId);
  const response = await request<{ listings: SurplusListing[] }>(API_ROUTES.myListings, actorId, {}, signal);
  return response.listings;
}

export async function getProfiles(actorId: string, signal?: AbortSignal): Promise<ResponderProfile[]> {
  if (demoMode) return mockGetProfiles();
  const response = await request<{ profiles: ResponderProfile[] }>(API_ROUTES.profiles, actorId, {}, signal);
  return response.profiles;
}

export async function getProfile(actorId: string, profileId: string, signal?: AbortSignal): Promise<ResponderProfile> {
  if (demoMode) return mockGetProfile(profileId);
  return request<ResponderProfile>(`${API_ROUTES.profiles}/${profileId}`, actorId, {}, signal);
}

export async function createListing(actorId: string, input: CreateListingRequest): Promise<SurplusListing> {
  if (demoMode) return mockCreateListing(actorId, input);
  return request<SurplusListing>(API_ROUTES.listings, actorId, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function claimListing(actorId: string, listingId: string): Promise<SurplusListing> {
  if (demoMode) return mockClaimListing(listingId, actorId);
  return request<SurplusListing>(`${API_ROUTES.listings}/${listingId}/claim`, actorId, { method: "POST" });
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

export async function getImpactDashboard(actorId: string, signal?: AbortSignal): Promise<ImpactDashboard> {
  if (demoMode) return mockGetDashboard();
  return request<ImpactDashboard>(API_ROUTES.dashboard, actorId, {}, signal);
}
