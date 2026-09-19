import React, { useState } from "react";
import type { CreateListingRequest, FoodCategory, SurplusListing } from "../../../shared/src/types.js";
import { DEMO_RESTAURANTS, DEFAULT_RESTAURANT } from "../mock.js";
import { StatusBadge } from "./StatusBadge.js";
import {
  Utensils,
  PlusCircle,
  Clock,
  ShieldCheck,
  CheckCircle,
  Leaf,
  Drumstick,
  Package,
  Radio,
  TrendingUp,
  AlertCircle,
  Heart
} from "lucide-react";

interface RestaurantViewProps {
  actorId: string;
  listings: SurplusListing[];
  onSubmitListing: (input: CreateListingRequest) => Promise<void>;
  onSelectListing: (id: string) => void;
  onPickup?: (listing: SurplusListing) => Promise<void>;
}

const PRESETS = [
  { desc: "South Indian Rice, Sambar & Dal", cat: "VEG" as FoodCategory, qty: 30, mins: 45, raw: "4kg rice, 3L sambar, 2L dal", unit: "packs" },
  { desc: "Fresh Bakery Breads & Pastries", cat: "PACKAGED" as FoodCategory, qty: 16, mins: 60, raw: "8 sourdough loaves, 12 croissants, 6 muffins", unit: "pieces" },
  { desc: "Vegetable Pulao & Raita", cat: "VEG" as FoodCategory, qty: 20, mins: 40, raw: "5kg veg pulao, 2L raita", unit: "boxes" },
  { desc: "Chicken Biryani & Salan", cat: "NON_VEG" as FoodCategory, qty: 25, mins: 45, raw: "6kg biryani, 2L salan, 1kg raita", unit: "packs" },
  { desc: "Corporate Buffet Surplus", cat: "VEG" as FoodCategory, qty: 45, mins: 75, raw: "80 chapatis, 5L paneer masala, 3kg jeera rice", unit: "trays" }
];

export const RestaurantView: React.FC<RestaurantViewProps> = ({
  actorId,
  listings,
  onSubmitListing,
  onSelectListing,
  onPickup
}) => {
  const currentRestaurant = DEMO_RESTAURANTS.find((r) => r.id === actorId) ?? DEFAULT_RESTAURANT;

  const [description, setDescription] = useState("South Indian Rice, Sambar & Dal Meals");
  const [quantityRaw, setQuantityRaw] = useState("5kg rice, 3L sambar, 2L dal");
  const [quantityUnit, setQuantityUnit] = useState("packs");
  const [quantity, setQuantity] = useState<number>(25);
  const [category, setCategory] = useState<FoodCategory>("VEG");
  const [pickupWindowMinutes, setPickupWindowMinutes] = useState<number>(45);
  const [safeSurplusDeclared, setSafeSurplusDeclared] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [dispatchesTab, setDispatchesTab] = useState<"ALL" | "ACTIVE" | "COMPLETED">("ALL");

  // Filter listings for this specific restaurant
  const restaurantListings = listings.filter((l) => l.restaurantId === currentRestaurant.id);
  const activeListings = restaurantListings.filter((l) => ["AVAILABLE", "CLAIMED", "PICKED_UP"].includes(l.status));
  const deliveredListings = restaurantListings.filter((l) => l.status === "DELIVERED");
  const totalMealsRescued = deliveredListings.reduce((sum, l) => sum + l.quantityMeals, 0);

  const displayedListings = dispatchesTab === "ACTIVE"
    ? activeListings
    : dispatchesTab === "COMPLETED"
    ? deliveredListings
    : restaurantListings;

  const formatRelativeClock = (mins: number) => {
    const d = new Date(Date.now() + mins * 60_000);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const applyPreset = (preset: (typeof PRESETS)[0]) => {
    setDescription(preset.desc);
    setCategory(preset.cat);
    setQuantity(preset.qty);
    setPickupWindowMinutes(preset.mins);
    setQuantityRaw(preset.raw);
    setQuantityUnit(preset.unit);
  };

  const handleDirectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!description.trim()) {
      setFormError("Please enter a description for the surplus food.");
      return;
    }
    if (quantity <= 0) {
      setFormError("Quantity must be at least 1 meal.");
      return;
    }
    if (!safeSurplusDeclared) {
      setFormError("Please tap the Safe Surplus Pledge ritual checkbox below to certify food safety before publishing.");
      return;
    }

    try {
      setIsSubmitting(true);
      const now = Date.now();
      const packedAtIso = new Date(now - 10 * 60_000).toISOString();
      const deadlineIso = new Date(now + pickupWindowMinutes * 60_000).toISOString();

      const newListingPayload: CreateListingRequest = {
        restaurantId: currentRestaurant.id,
        restaurantName: currentRestaurant.name,
        foodDescription: description.trim(),
        quantityMeals: quantity,
        quantityRaw: quantityRaw.trim() || undefined,
        quantityUnit: quantityUnit || undefined,
        foodCategory: category,
        latitude: currentRestaurant.latitude,
        longitude: currentRestaurant.longitude,
        packedAt: packedAtIso,
        pickupDeadline: deadlineIso
      };

      await onSubmitListing(newListingPayload);

      // Reset form
      setDescription("South Indian Rice, Sambar & Dal Meals");
      setQuantityRaw("5kg rice, 3L sambar, 2L dal");
      setQuantityUnit("packs");
      setQuantity(25);
      setSafeSurplusDeclared(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to publish listing");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="restaurant-view-container">
      {/* Restaurant Profile Summary Header */}
      <div className="restaurant-profile-header">
        <div className="profile-identity">
          <div className="restaurant-avatar">
            <Utensils size={24} />
          </div>
          <div>
            <div className="profile-title-row">
              <h2 className="profile-name">{currentRestaurant.name}</h2>
              <span className="verified-badge">
                <ShieldCheck size={14} />
                <span>FSSAI Partner Kitchen</span>
              </span>
            </div>
            <p className="profile-subtitle">
              📍 {currentRestaurant.area} • GPS: ({currentRestaurant.latitude.toFixed(4)}, {currentRestaurant.longitude.toFixed(4)})
            </p>
          </div>
        </div>

        <div className="restaurant-metrics-mini">
          <div className="metric-pill">
            <TrendingUp size={16} className="metric-icon" />
            <div>
              <strong className="metric-val">{totalMealsRescued}</strong>
              <span className="metric-label">Servings Rescued</span>
            </div>
          </div>
          <div className="metric-pill">
            <Heart size={16} className="metric-icon icon-heart" />
            <div>
              <strong className="metric-val">{deliveredListings.length}</strong>
              <span className="metric-label">Completed Drops</span>
            </div>
          </div>
        </div>
      </div>

      <div className="restaurant-grid-layout">
        {/* Single-Screen Fast Post Form */}
        <section className="form-card-panel">
          <div className="card-header-row">
            <div>
              <h3 className="card-section-title">Post Surplus Food</h3>
              <p className="card-section-desc">Broadcast unserved food to verified Bengaluru NGOs in under 30 seconds.</p>
            </div>
          </div>

          {/* Quick Presets for 1-Tap Entry */}
          <div className="presets-bar">
            <span className="presets-label">⚡ 1-Tap Presets:</span>
            <div className="presets-scroll">
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="preset-chip"
                  onClick={() => applyPreset(p)}
                >
                  {p.cat === "VEG" ? "🥗" : p.cat === "NON_VEG" ? "🍗" : "🍞"} {p.desc.split(" ")[0]} ({p.qty})
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleDirectSubmit} className="surplus-create-form">
            {formError && (
              <div className="form-error-banner">
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            {/* Food Description */}
            <div className="form-field-group">
              <label htmlFor="food-desc" className="form-label">
                What's the food? *
              </label>
              <input
                id="food-desc"
                type="text"
                className="text-input"
                placeholder="e.g. Steamed rice, dal tadka, and mixed vegetable poriyal"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {/* Raw Quantity — what the restaurant actually has */}
            <div className="form-row-duo">
              <div className="form-field-group">
                <label htmlFor="qty-raw" className="form-label">
                  What quantities? *
                </label>
                <input
                  id="qty-raw"
                  type="text"
                  className="text-input"
                  placeholder="e.g. 5kg rice, 3L sambar, 30 rotis"
                  value={quantityRaw}
                  onChange={(e) => setQuantityRaw(e.target.value)}
                />
              </div>
              <div className="form-field-group">
                <label htmlFor="qty-unit" className="form-label">
                  Packed as
                </label>
                <select
                  id="qty-unit"
                  className="text-input"
                  value={quantityUnit}
                  onChange={(e) => setQuantityUnit(e.target.value)}
                >
                  <option value="packs">Packs / Boxes</option>
                  <option value="trays">Trays / Containers</option>
                  <option value="pieces">Individual pieces</option>
                  <option value="kg">Loose (kg / litres)</option>
                </select>
              </div>
            </div>

            {/* Category 3 Large Tap Targets */}
            <div className="form-field-group">
              <label className="form-label">Dietary Category *</label>
              <div className="dietary-selector">
                <button
                  type="button"
                  className={`dietary-btn veg-btn ${category === "VEG" ? "selected" : ""}`}
                  onClick={() => setCategory("VEG")}
                >
                  <Leaf size={16} />
                  <span>Veg</span>
                </button>
                <button
                  type="button"
                  className={`dietary-btn nonveg-btn ${category === "NON_VEG" ? "selected" : ""}`}
                  onClick={() => setCategory("NON_VEG")}
                >
                  <Drumstick size={16} />
                  <span>Non-Veg</span>
                </button>
                <button
                  type="button"
                  className={`dietary-btn packaged-btn ${category === "PACKAGED" ? "selected" : ""}`}
                  onClick={() => setCategory("PACKAGED")}
                >
                  <Package size={16} />
                  <span>Dry / Bakery</span>
                </button>
              </div>
            </div>

            {/* Estimated Servings & Deadline */}
            <div className="form-row-duo">
              <div className="form-field-group">
                <label className="form-label">Feeds approx. how many people? *</label>
                <div className="quantity-stepper-wrap">
                  <button
                    type="button"
                    className="stepper-btn stepper-sub"
                    onClick={() => setQuantity(Math.max(1, quantity - 5))}
                    title="Reduce 5"
                  >
                    -5
                  </button>
                  <div className="stepper-center-badge">
                    <input
                      type="number"
                      min="1"
                      className="stepper-direct-input"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    />
                    <span className="stepper-unit-lbl">people</span>
                  </div>
                  <button
                    type="button"
                    className="stepper-btn stepper-add"
                    onClick={() => setQuantity(quantity + 5)}
                    title="Add 5"
                  >
                    +5
                  </button>
                  <button
                    type="button"
                    className="stepper-btn stepper-add-bulk"
                    onClick={() => setQuantity(quantity + 20)}
                    title="Add 20"
                  >
                    +20
                  </button>
                </div>
              </div>

              <div className="form-field-group">
                <label className="form-label">Pickup Deadline *</label>
                <div className="window-pill-selector">
                  {[30, 45, 60, 90].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      className={`window-pill ${pickupWindowMinutes === mins ? "active" : ""}`}
                      onClick={() => setPickupWindowMinutes(mins)}
                    >
                      <span className="window-mins-lead">+{mins}m</span>
                      <span className="window-clock-sub">({formatRelativeClock(mins)})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Ritual of Donating: Warm, Empowering Safety Confirmation */}
            <div className={`donation-ritual-card ${!safeSurplusDeclared ? "pledge-pending" : "pledge-signed"}`}>
              <label className="ritual-checkbox-label">
                <input
                  type="checkbox"
                  checked={safeSurplusDeclared}
                  onChange={(e) => setSafeSurplusDeclared(e.target.checked)}
                  required
                />
                <div className="ritual-text">
                  <strong>Safe Surplus Pledge (Tap to certify)</strong>
                  <span>
                    I confirm this surplus is freshly prepared, untouched, stored in clean food-grade containers, and ready for immediate consumption within {pickupWindowMinutes} minutes ({formatRelativeClock(pickupWindowMinutes)}).
                  </span>
                </div>
              </label>
            </div>

            <button type="submit" className="submit-listing-btn" disabled={isSubmitting}>
              <PlusCircle size={18} />
              <span>{isSubmitting ? "Broadcasting..." : `Publish — feeds ~${quantity} people`}</span>
            </button>
          </form>
        </section>

        {/* Live Dispatches Timeline */}
        <section className="restaurant-history-panel">
          <div className="card-header-row">
            <div>
              <h3 className="card-section-title">Your Dispatches & Status</h3>
              <p className="card-section-desc">Track real-time volunteer pickup progression.</p>
            </div>
            {/* Filter Tabs to Prevent Unbounded Growth */}
            <div className="dispatches-tab-group">
              <button
                type="button"
                className={`dispatch-tab-btn ${dispatchesTab === "ALL" ? "active" : ""}`}
                onClick={() => setDispatchesTab("ALL")}
              >
                All ({restaurantListings.length})
              </button>
              <button
                type="button"
                className={`dispatch-tab-btn ${dispatchesTab === "ACTIVE" ? "active" : ""}`}
                onClick={() => setDispatchesTab("ACTIVE")}
              >
                Active ({activeListings.length})
              </button>
              <button
                type="button"
                className={`dispatch-tab-btn ${dispatchesTab === "COMPLETED" ? "active" : ""}`}
                onClick={() => setDispatchesTab("COMPLETED")}
              >
                Done ({deliveredListings.length})
              </button>
            </div>
          </div>

          {displayedListings.length === 0 ? (
            <div className="empty-state-card">
              <Utensils size={36} className="empty-icon" />
              <h4>No dispatches in this view</h4>
              <p>{dispatchesTab === "COMPLETED" ? "Completed drop-offs will appear here." : "Post your first batch using the form on the left."}</p>
            </div>
          ) : (
            <div className="restaurant-listings-list-scroll">
              {displayedListings.map((listing) => {
                const remainingMins = Math.max(
                  0,
                  Math.round((new Date(listing.pickupDeadline).getTime() - Date.now()) / 60_000)
                );
                const isDelivered = listing.status === "DELIVERED";

                // Accurate step index progression (1: Posted, 2: Claimed, 3: Picked Up, 4: Delivered)
                const stepIndex =
                  listing.status === "DELIVERED" ? 4 :
                  listing.status === "PICKED_UP" ? 3 :
                  listing.status === "CLAIMED" ? 2 : 1;

                // Visually quiet completed cards
                if (isDelivered) {
                  const dietIcon = listing.foodCategory === "VEG" ? "🥗" : listing.foodCategory === "NON_VEG" ? "🍗" : "🍞";
                  return (
                    <article
                      key={listing.id}
                      className="restaurant-listing-card card-completed-quiet"
                      onClick={() => onSelectListing(listing.id)}
                    >
                      <div className="completed-card-header">
                        <div className="completed-title-wrap">
                          <span className="diet-mini-icon">{dietIcon}</span>
                          <h4 className="completed-listing-title">{listing.foodDescription}</h4>
                        </div>
                        <span className="completed-meals-badge">feeds {listing.quantityMeals}</span>
                      </div>
                      <div className="completed-meta-row">
                        <span className="completed-verdict-text">✓ Rescued & Delivered to Shelter</span>
                        <span className="completed-time-text">
                          Assigned: {listing.claimedBy || "NGO Volunteer"} · {new Date(listing.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </article>
                  );
                }

                // Active Dispatches (AVAILABLE, CLAIMED, PICKED_UP)
                return (
                  <article
                    key={listing.id}
                    className={`restaurant-listing-card status-border-${listing.status.toLowerCase()}`}
                    onClick={() => onSelectListing(listing.id)}
                  >
                    <div className="listing-card-header">
                      <div>
                        <div className="tag-and-time">
                          <span className={`cat-pill ${listing.foodCategory.toLowerCase()}`}>
                            {listing.foodCategory}
                          </span>
                          <span className="time-subtle">
                            {new Date(listing.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <h4 className="listing-title">{listing.foodDescription}</h4>
                      </div>
                      <div className="meals-badge">
                        <strong>{listing.quantityMeals}</strong>
                        <span>feeds</span>
                      </div>
                    </div>

                    <div className="listing-status-row">
                      {listing.status === "AVAILABLE" ? (
                        <span className="restaurant-live-pill">🟢 LIVE · BROADCASTING</span>
                      ) : (
                        <StatusBadge status={listing.status} />
                      )}
                      <div className="deadline-time-text">
                        {listing.status === "AVAILABLE" && `⏳ ${remainingMins}m safe window (until ${new Date(listing.pickupDeadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`}
                        {listing.status === "CLAIMED" && `Assigned: ${listing.claimedBy}`}
                        {listing.status === "PICKED_UP" && "In transit with volunteer"}
                      </div>
                    </div>

                    {/* Kitchen Pickup Handshake (FR-008 verification) */}
                    {listing.status === "CLAIMED" && (
                      <div className="kitchen-pickup-verify-box">
                        <div className="verify-box-header">
                          <span className="verify-volunteer-lead">
                            🔑 Volunteer Arrived: <strong>{listing.claimedBy}</strong>
                          </span>
                          <span className="verify-otp-tag">Expected Verbal OTP: <strong>8492</strong></span>
                        </div>
                        <p className="verify-instruction">
                          Ask volunteer for their 4-digit verbal OTP or scan their app QR before releasing containers.
                        </p>
                        <div className="verify-actions-row">
                          <button
                            type="button"
                            className="verify-otp-handover-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onPickup) {
                                void onPickup(listing);
                              }
                            }}
                          >
                            <CheckCircle size={15} />
                            <span>Verify Code (8492) & Authorize Kitchen Handover</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Visual Horizontal Progress Track with Mathematically Correct Progression */}
                    <div className="mini-journey-stepper">
                      <div className={`step-node ${stepIndex >= 1 ? "done" : ""}`}>
                        <span className="dot" />
                        <span className="lbl">Posted</span>
                      </div>
                      <div className={`step-line ${stepIndex >= 2 ? "active" : ""}`} />
                      <div className={`step-node ${stepIndex >= 2 ? "done" : ""}`}>
                        <span className="dot" />
                        <span className="lbl">Claimed</span>
                      </div>
                      <div className={`step-line ${stepIndex >= 3 ? "active" : ""}`} />
                      <div className={`step-node ${stepIndex >= 3 ? "done" : ""}`}>
                        <span className="dot" />
                        <span className="lbl">Picked Up</span>
                      </div>
                      <div className={`step-line ${stepIndex >= 4 ? "active" : ""}`} />
                      <div className={`step-node ${stepIndex >= 4 ? "done" : ""}`}>
                        <span className="dot" />
                        <span className="lbl">Delivered</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

