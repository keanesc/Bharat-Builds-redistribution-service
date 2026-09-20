import React, { useState, useEffect } from "react";
import type { FoodCategory, ResponderProfile, SurplusListing } from "../../../shared/src/types.js";
import { DEMO_RESPONDERS, DEFAULT_RESPONDER } from "../mock.js";
import { StatusBadge } from "./StatusBadge.js";
import {
  ShieldCheck,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  AlertTriangle,
  QrCode,
  KeyRound,
  XCircle,
  Package,
  Zap,
  RotateCcw,
  Navigation,
  ArrowRight,
  ArrowUpDown,
  Check
} from "lucide-react";

interface ResponderViewProps {
  actorId: string;
  listings: SurplusListing[];
  selectedListingId: string | null;
  onSelectListing: (id: string) => void;
  onClaim: (listing: SurplusListing, quantity?: number) => Promise<void>;
  onPickup: (listing: SurplusListing) => Promise<void>;
  onDeliver: (listing: SurplusListing) => Promise<void>;
  onCancel: (listing: SurplusListing) => Promise<void>;
}

function calculateTravelMetrics(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = Math.round(R * c * 10) / 10;
  const driveMins = Math.round(distanceKm * 2.8 + 4);
  return { distanceKm, driveMins };
}

export const ResponderView: React.FC<ResponderViewProps> = ({
  actorId,
  listings,
  selectedListingId,
  onSelectListing,
  onClaim,
  onPickup,
  onDeliver,
  onCancel
}) => {
  const currentResponder: ResponderProfile =
    DEMO_RESPONDERS.find((r) => r.id === actorId) ?? DEFAULT_RESPONDER;

  // Filter state
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const [onlyPriorityZone, setOnlyPriorityZone] = useState(false);
  const [onlyMyTasks, setOnlyMyTasks] = useState(false);
  const [sortBy, setSortBy] = useState<"best" | "deadline" | "distance" | "quantity">("best");

  // Active action states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [recentClaimId, setRecentClaimId] = useState<string | null>(null);
  const [graceSeconds, setGraceSeconds] = useState<number>(0);

  // Partial Claim Modal State
  const [partialClaimData, setPartialClaimData] = useState<{
    listing: SurplusListing;
    selectedQuantity: number;
    maxClaimable: number;
    driveMins: number;
    remainingMins: number;
  } | null>(null);

  // Risk confirmation dialog state
  const [riskWarningListing, setRiskWarningListing] = useState<{
    listing: SurplusListing;
    quantity: number;
    driveMins: number;
    remainingMins: number;
  } | null>(null);

  // OTP / QR Modal state
  const [pickupModalListing, setPickupModalListing] = useState<SurplusListing | null>(null);

  // Grace timer for undoing a claim
  useEffect(() => {
    if (!graceSeconds) return;
    const timer = setInterval(() => {
      setGraceSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [graceSeconds]);

  // Running committed vehicle capacity across active claims
  const committedMeals = listings
    .filter((l) => l.claimedBy === currentResponder.id && ["CLAIMED", "PICKED_UP"].includes(l.status))
    .reduce((sum, l) => sum + l.quantityMeals, 0);
  const remainingCapacity = Math.max(0, currentResponder.capacityMeals - committedMeals);
  const capacityUsedPercent = Math.min(100, Math.round((committedMeals / currentResponder.capacityMeals) * 100));

  // Active pickup for sticky HUD (first active claimed or in-transit task)
  const myActiveTask = listings.find(
    (l) => l.claimedBy === currentResponder.id && ["CLAIMED", "PICKED_UP"].includes(l.status)
  );

  // Smart matching & filtering
  const processedListings = listings
    .filter((listing) => {
      if (onlyMyTasks) return listing.claimedBy === currentResponder.id;
      if (filterCategory !== "ALL" && listing.foodCategory !== filterCategory) return false;
      const { distanceKm } = calculateTravelMetrics(
        currentResponder.latitude,
        currentResponder.longitude,
        listing.latitude,
        listing.longitude
      );
      if (onlyPriorityZone && distanceKm > 5) return false;
      if (onlyUrgent) {
        const remainingMs = new Date(listing.pickupDeadline).getTime() - Date.now();
        return remainingMs <= 30 * 60_000 && remainingMs > 0;
      }
      return true;
    })
    .sort((a, b) => {
      // Prioritize active tasks assigned to this responder
      if (a.claimedBy === currentResponder.id && b.claimedBy !== currentResponder.id) return -1;
      if (b.claimedBy === currentResponder.id && a.claimedBy !== currentResponder.id) return 1;

      const metricsA = calculateTravelMetrics(currentResponder.latitude, currentResponder.longitude, a.latitude, a.longitude);
      const metricsB = calculateTravelMetrics(currentResponder.latitude, currentResponder.longitude, b.latitude, b.longitude);

      if (sortBy === "deadline") {
        return new Date(a.pickupDeadline).getTime() - new Date(b.pickupDeadline).getTime();
      }
      if (sortBy === "distance") {
        return metricsA.distanceKm - metricsB.distanceKm;
      }
      if (sortBy === "quantity") {
        return b.quantityMeals - a.quantityMeals;
      }

      // Default: "best" match (5km priority zone + closest deadline)
      const isPriorityA = metricsA.distanceKm <= 5;
      const isPriorityB = metricsB.distanceKm <= 5;
      if (isPriorityA && !isPriorityB) return -1;
      if (!isPriorityA && isPriorityB) return 1;

      return new Date(a.pickupDeadline).getTime() - new Date(b.pickupDeadline).getTime();
    });

  const handleInitiateClaim = (listing: SurplusListing, driveMins: number, remainingMins: number) => {
    // If listing exceeds remaining capacity or responder wants custom quantity, open partial modal
    const maxClaimable = Math.min(listing.quantityMeals, remainingCapacity);
    if (remainingCapacity === 0) {
      alert("Your vehicle is currently at full capacity (50/50 meals). Complete an active drop first!");
      return;
    }

    if (listing.quantityMeals > remainingCapacity) {
      setPartialClaimData({
        listing,
        selectedQuantity: maxClaimable,
        maxClaimable,
        driveMins,
        remainingMins
      });
      return;
    }

    // Direct claim check for tight window
    if (driveMins >= remainingMins) {
      setRiskWarningListing({ listing, quantity: listing.quantityMeals, driveMins, remainingMins });
      return;
    }

    void executeClaim(listing, listing.quantityMeals);
  };

  const handleOpenPartialClaimModal = (listing: SurplusListing, driveMins: number, remainingMins: number) => {
    const maxClaimable = Math.min(listing.quantityMeals, remainingCapacity);
    setPartialClaimData({
      listing,
      selectedQuantity: maxClaimable > 0 ? maxClaimable : 1,
      maxClaimable: maxClaimable > 0 ? maxClaimable : listing.quantityMeals,
      driveMins,
      remainingMins
    });
  };

  const executeClaim = async (listing: SurplusListing, quantity: number) => {
    try {
      setActionLoadingId(listing.id);
      await onClaim(listing, quantity);
      setRecentClaimId(listing.id);
      setGraceSeconds(45); // 45s grace period to undo
      setRiskWarningListing(null);
      setPartialClaimData(null);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUndoClaim = async () => {
    if (!recentClaimId) return;
    const target = listings.find((l) => l.id === recentClaimId);
    if (target) {
      await onCancel(target);
      setRecentClaimId(null);
      setGraceSeconds(0);
    }
  };

  const handleSelectNextBestMatch = () => {
    const nextAvailable = listings.find((l) => l.status === "AVAILABLE" && l.id !== selectedListingId);
    if (nextAvailable) {
      onSelectListing(nextAvailable.id);
    }
  };

  const myClaimedCount = listings.filter(
    (l) => l.claimedBy === currentResponder.id && ["CLAIMED", "PICKED_UP"].includes(l.status)
  ).length;

  return (
    <div className="responder-view-container">
      {/* Undo Grace Bar (appears for 45s after claiming) */}
      {graceSeconds > 0 && recentClaimId && (
        <div className="undo-grace-bar">
          <div className="grace-text">
            <span>✓ Claim locked! You have <strong>{graceSeconds}s</strong> to release without penalty if claimed by mistake.</span>
          </div>
          <button type="button" className="grace-undo-btn" onClick={() => void handleUndoClaim()}>
            <RotateCcw size={13} />
            <span>Release Claim</span>
          </button>
        </div>
      )}

      {/* Ultra-Compact Responder Header with Inline Vehicle Load Meter */}
      <div className="responder-profile-card-compact">
        <div className="profile-compact-left">
          <div className="responder-avatar-compact">
            <Truck size={18} />
          </div>
          <div className="responder-info-compact">
            <div className="responder-name-row">
              <h2 className="profile-name-compact">{currentResponder.name}</h2>
              {currentResponder.verified && (
                <span className="verified-badge-compact" title="Verified NGO Partner">
                  <ShieldCheck size={12} />
                  <span>Verified</span>
                </span>
              )}
            </div>
            <p className="profile-sub-compact">
              📍 ({currentResponder.latitude.toFixed(3)}, {currentResponder.longitude.toFixed(3)}) · Max {currentResponder.capacityMeals} meals
            </p>
          </div>
        </div>

        <div className="profile-compact-right">
          <div className="vehicle-load-inline">
            <div className="load-inline-label">
              <span>Vehicle Load:</span>
              <strong>{committedMeals} / {currentResponder.capacityMeals}</strong>
              <span className={`load-mini-tag ${remainingCapacity === 0 ? "tag-full" : "tag-space"}`}>
                {remainingCapacity === 0 ? "FULL" : `${remainingCapacity} left`}
              </span>
            </div>
            <div className="vehicle-load-track-compact">
              <div
                className={`vehicle-load-fill-compact ${capacityUsedPercent >= 90 ? "fill-critical" : capacityUsedPercent >= 60 ? "fill-warn" : "fill-normal"}`}
                style={{ width: `${capacityUsedPercent}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            className={`my-tasks-compact-btn ${onlyMyTasks ? "active" : ""}`}
            onClick={() => setOnlyMyTasks(!onlyMyTasks)}
          >
            <span>My Rescues</span>
            <span className="task-counter-badge">{myClaimedCount}</span>
          </button>
        </div>
      </div>

      {/* Streamlined Filter & Sort Bar */}
      <div className="feed-filter-bar-streamlined">
        <div className="filter-chips-cluster">
          {/* Diet filter chips */}
          <div className="diet-chips-row">
            {[
              { id: "ALL", label: "All" },
              { id: "VEG", label: "🥗 Veg" },
              { id: "NON_VEG", label: "🍗 Non-Veg" },
              { id: "PACKAGED", label: "🍞 Bakery" }
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                className={`compact-chip ${filterCategory === d.id ? "active" : ""}`}
                onClick={() => setFilterCategory(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div className="divider-v" />

          {/* Quick toggle chips */}
          <div className="quick-toggles-row">
            <button
              type="button"
              className={`compact-toggle-chip ${onlyPriorityZone ? "active" : ""}`}
              onClick={() => setOnlyPriorityZone(!onlyPriorityZone)}
              title="Within 5km priority zone"
            >
              <Zap size={11} />
              <span>5km Priority</span>
            </button>
            <button
              type="button"
              className={`compact-toggle-chip ${onlyUrgent ? "active" : ""}`}
              onClick={() => setOnlyUrgent(!onlyUrgent)}
            >
              <Clock size={11} />
              <span>Urgent (&lt;30m)</span>
            </button>
          </div>
        </div>

        {/* Compact Sort */}
        <div className="sort-inline-wrap">
          <select
            id="sort-select"
            className="compact-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="best">Sort: Best Match ▾</option>
            <option value="deadline">Sort: Soonest Deadline ▾</option>
            <option value="distance">Sort: Nearest Distance ▾</option>
            <option value="quantity">Sort: Largest Quantity ▾</option>
          </select>
        </div>
      </div>

      {/* Slim Filter Summary Strip */}
      <div className="filter-results-summary-slim">
        <span className="results-count-text-slim">
          {filterCategory === "ALL" && !onlyUrgent && !onlyPriorityZone && !onlyMyTasks ? (
            <span><strong>{listings.length} pickups</strong> available across 10 km corridor</span>
          ) : (
            <span>
              <strong>{processedListings.length} of {listings.length}</strong> match filters
            </span>
          )}
        </span>
        {(filterCategory !== "ALL" || onlyUrgent || onlyPriorityZone || onlyMyTasks) && (
          <button
            type="button"
            className="clear-filters-link-slim"
            onClick={() => {
              setFilterCategory("ALL");
              setOnlyUrgent(false);
              setOnlyPriorityZone(false);
              setOnlyMyTasks(false);
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Streamlined Listing Feed */}
      <div className="responder-feed-list">
        {processedListings.length === 0 ? (
          <div className="empty-state-card">
            <Package size={36} className="empty-icon" />
            <h4>No pickups match your active filter</h4>
            <p>Try resetting filters or expanding diet and distance radius.</p>
            <button
              type="button"
              className="clear-filters-link-slim"
              style={{ marginTop: 8 }}
              onClick={() => {
                setFilterCategory("ALL");
                setOnlyUrgent(false);
                setOnlyPriorityZone(false);
                setOnlyMyTasks(false);
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          processedListings.map((listing) => {
            const { distanceKm, driveMins } = calculateTravelMetrics(
              currentResponder.latitude,
              currentResponder.longitude,
              listing.latitude,
              listing.longitude
            );

            const remainingMs = new Date(listing.pickupDeadline).getTime() - Date.now();
            const remainingMins = Math.max(0, Math.round(remainingMs / 60_000));
            const isExpired = remainingMs <= 0 || listing.status === "EXPIRED";

            const fitsCapacity = listing.quantityMeals <= remainingCapacity;
            const isClaimedByMe = listing.claimedBy === currentResponder.id;
            const isClaimedByOther = !!listing.claimedBy && listing.claimedBy !== currentResponder.id;
            const isSelected = selectedListingId === listing.id;
            const isInsidePriorityZone = distanceKm <= 5;
            const dietIcon = listing.foodCategory === "VEG" ? "🥗" : listing.foodCategory === "NON_VEG" ? "🍗" : "🍞";

            // Composite Status Verdict
            let statusBadgeContent = null;
            let statusTone = "safe";

            if (isExpired) {
              statusTone = "expired";
              statusBadgeContent = <span className="composite-verdict text-expired">✕ Expired · Pickup window closed</span>;
            } else if (listing.status === "CLAIMED" && isClaimedByMe) {
              statusTone = "claimed";
              statusBadgeContent = <span className="composite-verdict text-claimed">🔵 Assigned to You · Ready for Pickup</span>;
            } else if (listing.status === "PICKED_UP" && isClaimedByMe) {
              statusTone = "picked";
              statusBadgeContent = <span className="composite-verdict text-picked">🚚 In Transit · Delivering to Shelter</span>;
            } else if (isClaimedByOther) {
              statusTone = "other";
              statusBadgeContent = <span className="composite-verdict text-other">🔒 Claimed by {listing.claimedBy}</span>;
            } else if (listing.status === "DELIVERED") {
              statusTone = "delivered";
              statusBadgeContent = <span className="composite-verdict text-delivered">✓ Delivered to Shelter</span>;
            } else {
              // AVAILABLE
              const urgencyIcon = driveMins >= remainingMins ? "🔴" : remainingMins - driveMins <= 15 ? "🟠" : "🟢";
              statusTone = driveMins >= remainingMins ? "risk" : remainingMins - driveMins <= 15 ? "tight" : "safe";
              statusBadgeContent = (
                <span className={`composite-verdict text-${statusTone}`}>
                  <span className="diet-icon-mini" title={listing.foodCategory}>{dietIcon}</span>
                  <span>{urgencyIcon} <strong>{remainingMins}m left</strong> · {driveMins}m drive{isInsidePriorityZone ? " · ⚡ Priority" : ""}</span>
                </span>
              );
            }

            return (
              <article
                key={listing.id}
                className={`streamlined-listing-card ${isSelected ? "selected-card" : ""} ${
                  isClaimedByMe ? "claimed-by-me" : ""
                } tone-${statusTone}`}
                onClick={() => onSelectListing(listing.id)}
              >
                {/* Row 1: Composite Status Verdict + Big Meal Badge */}
                <div className="card-row-verdict">
                  <div className="verdict-left">{statusBadgeContent}</div>
                  <div className="meals-badge-prominent">
                    <span className="meals-num">{listing.quantityMeals}</span>
                    <span className="meals-unit">feeds</span>
                  </div>
                </div>

                {/* Row 2: Food Headline + Raw Quantity */}
                <h3 className="card-food-title">{listing.foodDescription}</h3>
                {listing.quantityRaw && (
                  <p className="card-quantity-raw">{listing.quantityRaw}</p>
                )}

                {/* Row 3: Location + Distance */}
                <p className="card-location-line">
                  <MapPin size={12} className="loc-icon" />
                  <span><strong>{listing.restaurantName}</strong> · {distanceKm}km away</span>
                </p>

                {/* Row 4: CTAs with capacity math folded directly into button */}
                <div className="card-actions-row">
                  {listing.status === "AVAILABLE" && !isExpired && (
                    <div className="available-cta-wrap">
                      {remainingCapacity === 0 ? (
                        <button type="button" className="btn-cta btn-disabled" disabled>
                          Vehicle Full (0 / {currentResponder.capacityMeals} space)
                        </button>
                      ) : fitsCapacity ? (
                        <>
                          <button
                            type="button"
                            className="btn-cta btn-primary-claim"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInitiateClaim(listing, driveMins, remainingMins);
                            }}
                            disabled={actionLoadingId === listing.id}
                          >
                            <Zap size={14} />
                            <span>{actionLoadingId === listing.id ? "Locking..." : `Claim All · ${listing.quantityMeals} servings`}</span>
                          </button>
                          <button
                            type="button"
                            className="btn-cta btn-subtle-partial"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPartialClaimModal(listing, driveMins, remainingMins);
                            }}
                            disabled={actionLoadingId === listing.id}
                            title="Claim a smaller portion"
                          >
                            Partial Qty
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn-cta btn-primary-claim btn-capacity-capped"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInitiateClaim(listing, driveMins, remainingMins);
                            }}
                            disabled={actionLoadingId === listing.id}
                          >
                            <Zap size={14} />
                            <span>{actionLoadingId === listing.id ? "Locking..." : `Claim ${remainingCapacity} of ${listing.quantityMeals} servings`}</span>
                          </button>
                          <button
                            type="button"
                            className="btn-cta btn-subtle-partial"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPartialClaimModal(listing, driveMins, remainingMins);
                            }}
                            disabled={actionLoadingId === listing.id}
                            title="Custom portion"
                          >
                            Custom Qty
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {listing.status === "CLAIMED" && isClaimedByMe && (
                    <div className="claimed-cta-wrap">
                      <button
                        type="button"
                        className="btn-cta btn-release"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onCancel(listing);
                        }}
                        disabled={actionLoadingId === listing.id}
                      >
                        <XCircle size={13} />
                        <span>Release Claim</span>
                      </button>
                      <button
                        type="button"
                        className="btn-cta btn-handshake-otp"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPickupModalListing(listing);
                        }}
                        disabled={actionLoadingId === listing.id}
                      >
                        <QrCode size={14} />
                        <span>Verify Pickup (OTP 8492)</span>
                      </button>
                    </div>
                  )}

                  {listing.status === "PICKED_UP" && isClaimedByMe && (
                    <button
                      type="button"
                      className="btn-cta btn-deliver"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onDeliver(listing);
                      }}
                      disabled={actionLoadingId === listing.id}
                    >
                      <CheckCircle2 size={14} />
                      <span>Confirm Shelter Delivery</span>
                    </button>
                  )}

                  {isClaimedByOther && (
                    <button
                      type="button"
                      className="btn-cta btn-see-next"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectNextBestMatch();
                      }}
                    >
                      <span>See Next Match</span>
                      <ArrowRight size={12} />
                    </button>
                  )}

                  {listing.status === "DELIVERED" && (
                    <div className="badge-delivered-simple">
                      <CheckCircle2 size={14} />
                      <span>Completed & Delivered</span>
                    </div>
                  )}

                  {isExpired && listing.status === "AVAILABLE" && (
                    <div className="badge-expired-simple">
                      <AlertTriangle size={13} />
                      <span>Expired</span>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Sticky Bottom HUD for Active Pickups (Mobile/Scooter Rider View) */}
      {myActiveTask && (
        <aside id="sticky-hud" className="sticky-rider-hud" aria-label="Active Pickup HUD">
          <div className="hud-inner">
            <div className="hud-left">
              <span className="hud-status-pulse" />
              <div className="hud-task-details">
                <span className="hud-tag">
                  {myActiveTask.status === "CLAIMED" ? "EN ROUTE TO KITCHEN" : "EN ROUTE TO SHELTER"}
                </span>
                <h4 className="hud-title">{myActiveTask.foodDescription}</h4>
                <p className="hud-address">📍 {myActiveTask.restaurantName} (feeds {myActiveTask.quantityMeals})</p>
              </div>
            </div>

            <div className="hud-actions">
              {myActiveTask.status === "CLAIMED" ? (
                <>
                  <button
                    type="button"
                    className="hud-action-btn hud-release"
                    onClick={() => void onCancel(myActiveTask)}
                    title="Release claim"
                  >
                    <XCircle size={15} />
                    <span>Release</span>
                  </button>
                  <button
                    type="button"
                    className="hud-action-btn hud-pickup"
                    onClick={() => setPickupModalListing(myActiveTask)}
                  >
                    <KeyRound size={16} />
                    <span>Show OTP (8492)</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="hud-action-btn hud-deliver"
                  onClick={() => void onDeliver(myActiveTask)}
                >
                  <CheckCircle2 size={16} />
                  <span>Confirm Shelter Delivery</span>
                </button>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* Partial Quantity Claim Modal */}
      {partialClaimData && (
        <div className="modal-backdrop">
          <div className="modal-dialog partial-claim-dialog">
            <div className="modal-header">
              <div className="modal-icon-wrap partial-icon-bg">
                <Package size={24} className="partial-modal-icon" />
              </div>
              <div>
                <h3 className="modal-title">Select Quantity to Claim</h3>
                <p className="modal-desc">
                  <strong>{partialClaimData.listing.foodDescription}</strong> at {partialClaimData.listing.restaurantName} (feeds {partialClaimData.listing.quantityMeals} total).
                </p>
              </div>
            </div>

            <div className="partial-dialog-body">
              <div className="portion-selector-panel">
                <label className="portion-label">How many meals will your vehicle collect?</label>
                <div className="portion-stepper-row">
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() =>
                      setPartialClaimData({
                        ...partialClaimData,
                        selectedQuantity: Math.max(1, partialClaimData.selectedQuantity - 5)
                      })
                    }
                  >
                    -5
                  </button>
                  <div className="portion-count-badge">
                    <input
                      type="number"
                      min="1"
                      max={partialClaimData.maxClaimable}
                      className="portion-number-input"
                      value={partialClaimData.selectedQuantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 1;
                        setPartialClaimData({
                          ...partialClaimData,
                          selectedQuantity: Math.min(partialClaimData.maxClaimable, Math.max(1, val))
                        });
                      }}
                    />
                    <span className="portion-unit">meals</span>
                  </div>
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() =>
                      setPartialClaimData({
                        ...partialClaimData,
                        selectedQuantity: Math.min(
                          partialClaimData.maxClaimable,
                          partialClaimData.selectedQuantity + 5
                        )
                      })
                    }
                  >
                    +5
                  </button>
                </div>

                {/* Quick Portions Preset Chips */}
                <div className="quick-portion-chips">
                  {[
                    { label: "10 Meals", qty: 10 },
                    { label: "Half Batch", qty: Math.floor(partialClaimData.listing.quantityMeals / 2) },
                    { label: `Max Capacity (${partialClaimData.maxClaimable})`, qty: partialClaimData.maxClaimable }
                  ]
                    .filter((chip) => chip.qty > 0 && chip.qty <= partialClaimData.listing.quantityMeals)
                    .map((chip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`portion-chip ${partialClaimData.selectedQuantity === chip.qty ? "selected" : ""}`}
                        onClick={() =>
                          setPartialClaimData({
                            ...partialClaimData,
                            selectedQuantity: Math.min(partialClaimData.maxClaimable, chip.qty)
                          })
                        }
                      >
                        {chip.label}
                      </button>
                    ))}
                </div>

                <div className="capacity-impact-note">
                  <span>
                    Remaining vehicle space after claim:{" "}
                    <strong>{Math.max(0, remainingCapacity - partialClaimData.selectedQuantity)} meals</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="cancel-modal-btn"
                onClick={() => setPartialClaimData(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-claim-portion-btn"
                onClick={() => {
                  if (partialClaimData.driveMins >= partialClaimData.remainingMins) {
                    setRiskWarningListing({
                      listing: partialClaimData.listing,
                      quantity: partialClaimData.selectedQuantity,
                      driveMins: partialClaimData.driveMins,
                      remainingMins: partialClaimData.remainingMins
                    });
                    setPartialClaimData(null);
                    return;
                  }
                  void executeClaim(partialClaimData.listing, partialClaimData.selectedQuantity);
                }}
              >
                <Zap size={16} />
                <span>Claim {partialClaimData.selectedQuantity} servings</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Soft Travel-Risk Warning Dialog */}
      {riskWarningListing && (
        <div className="modal-backdrop">
          <div className="modal-dialog risk-warning-dialog">
            <div className="modal-header">
              <div className="modal-icon-wrap warn-icon-bg">
                <AlertTriangle size={24} className="warn-modal-icon" />
              </div>
              <div>
                <h3 className="modal-title">Tight Travel Window Warning</h3>
                <p className="modal-desc">
                  This donation requires <strong>~{riskWarningListing.driveMins} mins drive</strong> in Bengaluru traffic, but only <strong>{riskWarningListing.remainingMins} mins</strong> remain in the safe consumption window.
                </p>
              </div>
            </div>

            <div className="risk-dialog-body">
              <p className="risk-hint">
                If traffic delays your arrival past the deadline, this food may expire unclaimed. Do you have a volunteer already near {riskWarningListing.listing.restaurantName}?
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="cancel-modal-btn"
                onClick={() => setRiskWarningListing(null)}
              >
                Choose Closer Pickup
              </button>
              <button
                type="button"
                className="confirm-risk-claim-btn"
                onClick={() => void executeClaim(riskWarningListing.listing, riskWarningListing.quantity)}
              >
                <span>Commit & Claim {riskWarningListing.quantity} Meals</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FR-008 Kitchen Pickup Handshake Modal */}
      {pickupModalListing && (
        <div className="modal-backdrop">
          <div className="modal-dialog pickup-dialog">
            <div className="modal-header">
              <div className="modal-icon-wrap otp-icon-bg">
                <KeyRound size={24} className="otp-modal-icon" />
              </div>
              <div>
                <h3 className="modal-title">Kitchen Pickup Verification</h3>
                <p className="modal-desc">
                  Present this OTP or scan QR at <strong>{pickupModalListing.restaurantName}</strong> to collect {pickupModalListing.quantityMeals} servings.
                </p>
              </div>
            </div>

            <div className="pickup-handshake-body">
              <div className="qr-card-simulation">
                <div className="qr-box">
                  <QrCode size={110} strokeWidth={1.5} className="qr-svg-icon" />
                </div>
                <span className="qr-caption">Staff scan with RescueRadius Kitchen app</span>
              </div>

              <div className="otp-display-box">
                <span className="otp-label">OR VERBAL 4-DIGIT CODE</span>
                <div className="otp-digits">
                  <span className="otp-digit">8</span>
                  <span className="otp-digit">4</span>
                  <span className="otp-digit">9</span>
                  <span className="otp-digit">2</span>
                </div>
                <span className="otp-note">Staff verify this code before releasing food containers.</span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="cancel-modal-btn"
                onClick={() => setPickupModalListing(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="confirm-pickup-btn"
                onClick={async () => {
                  await onPickup(pickupModalListing);
                  setPickupModalListing(null);
                }}
              >
                <Truck size={16} />
                <span>Confirm Packages Received & Start Transit</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
