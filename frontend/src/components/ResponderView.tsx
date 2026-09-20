import { useMemo, useState } from "react";
import type { FoodCategory, ResponderProfile, SurplusListing } from "../../../shared/src/types.js";
import { BengaluruMap } from "./BengaluruMap.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
import { StatusBadge } from "./StatusBadge.js";

export interface ResponderFilters {
  foodCategory?: FoodCategory;
  minQuantity?: number;
  maxMinutesUntilDeadline?: number;
}

interface ResponderViewProps {
  responder: ResponderProfile;
  availableListings: SurplusListing[];
  myListings: SurplusListing[];
  filters: ResponderFilters;
  loading: boolean;
  error: string | null;
  onFiltersChange: (filters: ResponderFilters) => void;
  onClaim: (listing: SurplusListing) => Promise<void>;
  onPickup: (listing: SurplusListing) => Promise<void>;
  onDeliver: (listing: SurplusListing) => Promise<void>;
  onCancel: (listing: SurplusListing) => Promise<void>;
  onRetry: () => void;
}

type PendingAction = { type: "pickup" | "deliver" | "cancel"; listing: SurplusListing };

function distanceKm(origin: ResponderProfile, listing: SurplusListing): number {
  const radius = 6371;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(listing.latitude - origin.latitude);
  const dLon = radians(listing.longitude - origin.longitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(origin.latitude)) * Math.cos(radians(listing.latitude)) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function deadlineText(deadline: string): string {
  const minutes = Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 60_000));
  return `${minutes} min remaining`;
}

export function ResponderView({
  responder,
  availableListings,
  myListings,
  filters,
  loading,
  error,
  onFiltersChange,
  onClaim,
  onPickup,
  onDeliver,
  onCancel,
  onRetry
}: ResponderViewProps) {
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const activeTasks = useMemo(
    () => myListings.filter((item) => item.status === "CLAIMED" || item.status === "PICKED_UP"),
    [myListings]
  );
  const completedTasks = useMemo(
    () => myListings.filter((item) => item.status === "DELIVERED" || item.status === "CANCELLED"),
    [myListings]
  );
  const committedMeals = activeTasks.reduce((sum, item) => sum + item.quantityMeals, 0);
  const remainingCapacity = Math.max(0, responder.capacityMeals - committedMeals);
  const mapListings = useMemo(() => {
    const byId = new Map<string, SurplusListing>();
    [...availableListings, ...activeTasks].forEach((item) => byId.set(item.id, item));
    return [...byId.values()];
  }, [activeTasks, availableListings]);

  const runConfirmedAction = async () => {
    if (!pendingAction) return;
    setBusyId(pendingAction.listing.id);
    try {
      if (pendingAction.type === "pickup") await onPickup(pendingAction.listing);
      if (pendingAction.type === "deliver") await onDeliver(pendingAction.listing);
      if (pendingAction.type === "cancel") await onCancel(pendingAction.listing);
      setPendingAction(null);
    } finally {
      setBusyId(null);
    }
  };

  const claim = async (listing: SurplusListing) => {
    setBusyId(listing.id);
    try {
      await onClaim(listing);
    } finally {
      setBusyId(null);
    }
  };

  const dialogCopy = pendingAction ? {
    pickup: {
      title: "Confirm pickup",
      description: `Confirm that you collected ${pendingAction.listing.quantityMeals} meals from ${pendingAction.listing.restaurantName}.`,
      label: "Confirm pickup",
      tone: "primary" as const
    },
    deliver: {
      title: "Confirm delivery",
      description: `Confirm that the ${pendingAction.listing.quantityMeals} meals were delivered.`,
      label: "Confirm delivery",
      tone: "primary" as const
    },
    cancel: {
      title: "Cancel claim",
      description: "This closes the claim permanently. The current backend does not return the listing to the available pool.",
      label: "Cancel claim",
      tone: "danger" as const
    }
  }[pendingAction.type] : null;

  return (
    <div className="responder-view">
      <section className="responder-summary" aria-labelledby="responder-heading">
        <div>
          <h1 id="responder-heading">{responder.name}</h1>
          <p>{responder.role === "NGO" ? "NGO responder" : "Volunteer responder"} · {responder.verified ? "Verified" : "Unverified"}</p>
        </div>
        <dl className="capacity-summary">
          <div><dt>Vehicle capacity</dt><dd>{responder.capacityMeals} meals</dd></div>
          <div><dt>Committed</dt><dd>{committedMeals} meals</dd></div>
          <div><dt>Available</dt><dd>{remainingCapacity} meals</dd></div>
        </dl>
      </section>

      {activeTasks.length > 0 && (
        <section className="active-task-section" aria-labelledby="active-task-heading">
          <div className="section-header compact">
            <div>
              <h2 id="active-task-heading">Active tasks</h2>
              <p>Complete each pickup using the actor assigned to the claim.</p>
            </div>
          </div>
          <div className="active-task-list">
            {activeTasks.map((listing) => (
              <article className="active-task" key={listing.id}>
                <div>
                  <div className="task-heading"><h3>{listing.foodDescription}</h3><StatusBadge status={listing.status} /></div>
                  <p>{listing.restaurantName} · {listing.quantityMeals} meals</p>
                  <p className="muted">Pickup deadline: {new Date(listing.pickupDeadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <div className="task-actions">
                  {listing.status === "CLAIMED" && (
                    <>
                      <button className="button primary" type="button" onClick={() => setPendingAction({ type: "pickup", listing })}>Confirm pickup</button>
                      <button className="button danger-link" type="button" onClick={() => setPendingAction({ type: "cancel", listing })}>Cancel claim</button>
                    </>
                  )}
                  {listing.status === "PICKED_UP" && (
                    <button className="button primary" type="button" onClick={() => setPendingAction({ type: "deliver", listing })}>Confirm delivery</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="responder-workspace">
        <BengaluruMap
          listings={mapListings}
          selectedListingId={selectedListingId}
          responder={responder}
          onSelectListing={setSelectedListingId}
        />

        <section className="panel feed-panel" aria-labelledby="available-heading">
          <div className="section-header compact">
            <div>
              <h2 id="available-heading">Available pickups</h2>
              <p>Listings are ordered by pickup deadline.</p>
            </div>
          </div>

          <div className="filter-bar">
            <label>Category
              <select
                value={filters.foodCategory ?? ""}
                onChange={(event) => onFiltersChange({ ...filters, foodCategory: (event.target.value || undefined) as FoodCategory | undefined })}
              >
                <option value="">All</option>
                <option value="VEG">Vegetarian</option>
                <option value="NON_VEG">Non-vegetarian</option>
                <option value="PACKAGED">Packaged</option>
              </select>
            </label>
            <label>Minimum meals
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={filters.minQuantity ?? ""}
                onChange={(event) => onFiltersChange({ ...filters, minQuantity: event.target.value ? Number(event.target.value) : undefined })}
              />
            </label>
            <label>Deadline
              <select
                value={filters.maxMinutesUntilDeadline ?? ""}
                onChange={(event) => onFiltersChange({ ...filters, maxMinutesUntilDeadline: event.target.value ? Number(event.target.value) : undefined })}
              >
                <option value="">Any window</option>
                <option value="30">Within 30 min</option>
                <option value="60">Within 60 min</option>
                <option value="90">Within 90 min</option>
              </select>
            </label>
          </div>

          {error && <div className="inline-error">{error}<button type="button" onClick={onRetry}>Retry</button></div>}
          {loading && !availableListings.length ? <div className="skeleton-list" aria-label="Loading pickups"><i /><i /><i /></div> : (
            <div className="listing-feed">
              {availableListings.length === 0 && <p className="empty-copy">No available pickups match these filters.</p>}
              {availableListings.map((listing) => {
                const overCapacity = listing.quantityMeals > remainingCapacity;
                const selected = selectedListingId === listing.id;
                return (
                  <article className={selected ? "listing-card selected" : "listing-card"} key={listing.id}>
                    <button className="listing-card-main" type="button" onClick={() => setSelectedListingId(listing.id)}>
                      <span className="listing-card-top"><strong>{listing.foodDescription}</strong><b>{listing.quantityMeals} meals</b></span>
                      <span>{listing.restaurantName}</span>
                      <span className="listing-meta">
                        <span>{listing.foodCategory.replace("_", "-").toLowerCase()}</span>
                        <span>{distanceKm(responder, listing).toFixed(1)} km straight-line</span>
                        <span>{deadlineText(listing.pickupDeadline)}</span>
                      </span>
                    </button>
                    <div className="claim-row">
                      {overCapacity && <span>Exceeds remaining vehicle capacity.</span>}
                      <button
                        type="button"
                        className="button primary"
                        disabled={overCapacity || busyId === listing.id}
                        onClick={() => void claim(listing)}
                      >
                        {busyId === listing.id ? "Claiming…" : "Claim pickup"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {completedTasks.length > 0 && (
        <section className="panel recent-section" aria-labelledby="recent-heading">
          <div className="section-header compact"><div><h2 id="recent-heading">Recent activity</h2></div></div>
          <div className="recent-grid">
            {completedTasks.slice(0, 4).map((listing) => (
              <article key={listing.id}>
                <div><strong>{listing.foodDescription}</strong><StatusBadge status={listing.status} /></div>
                <p>{listing.restaurantName} · {listing.quantityMeals} meals</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {pendingAction && dialogCopy && (
        <ConfirmDialog
          title={dialogCopy.title}
          description={dialogCopy.description}
          confirmLabel={dialogCopy.label}
          tone={dialogCopy.tone}
          busy={busyId === pendingAction.listing.id}
          onClose={() => setPendingAction(null)}
          onConfirm={() => void runConfirmedAction()}
        />
      )}
    </div>
  );
}
