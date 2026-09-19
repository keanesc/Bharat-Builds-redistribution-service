import type { ListingStatus, StatusEvent } from "@rescue-radius/shared";

const transitions: Record<ListingStatus, ListingStatus[]> = {
  AVAILABLE: ["CLAIMED", "CANCELLED", "EXPIRED"],
  CLAIMED: ["PICKED_UP", "CANCELLED", "AVAILABLE", "EXPIRED"],
  PICKED_UP: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: ["AVAILABLE"],
  EXPIRED: []
};

export function canTransition(from: ListingStatus, to: ListingStatus): boolean {
  return transitions[from].includes(to);
}

export function statusEvent(
  from: ListingStatus | null,
  to: ListingStatus,
  actorId: string,
  timestamp: string,
  reason?: string
): StatusEvent {
  return { from, to, actorId, timestamp, ...(reason ? { reason } : {}) };
}
