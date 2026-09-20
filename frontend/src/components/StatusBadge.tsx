import type { ListingStatus } from "../../../shared/src/types.js";

const labels: Record<ListingStatus, string> = {
  AVAILABLE: "Available",
  CLAIMED: "Claimed",
  PICKED_UP: "Picked up",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired"
};

export function StatusBadge({ status }: { status: ListingStatus }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{labels[status]}</span>;
}
