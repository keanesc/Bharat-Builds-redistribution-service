import { useMemo, useState } from "react";
import type { CreateListingRequest, FoodCategory, SurplusListing } from "../../../shared/src/types.js";
import { DEFAULT_RESTAURANT } from "../mock.js";
import { StatusBadge } from "./StatusBadge.js";

interface RestaurantViewProps {
  listings: SurplusListing[];
  loading: boolean;
  error: string | null;
  onSubmit: (input: CreateListingRequest) => Promise<void>;
  onRetry: () => void;
}

type FieldErrors = Partial<Record<"description" | "quantity" | "packedAt" | "deadline" | "safety", string>>;

function localInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function lastTransition(listing: SurplusListing): string | null {
  const event = listing.statusHistory.at(-1);
  return event ? formatDate(event.timestamp) : null;
}

function ListingRow({ listing }: { listing: SurplusListing }) {
  return (
    <article className="history-row">
      <div className="history-main">
        <div className="history-title">
          <h3>{listing.foodDescription}</h3>
          <StatusBadge status={listing.status} />
        </div>
        <p>{listing.quantityMeals} meals · {listing.foodCategory.replace("_", "-").toLowerCase()}</p>
      </div>
      <dl className="history-details">
        <div><dt>Pickup deadline</dt><dd>{formatDate(listing.pickupDeadline)}</dd></div>
        {listing.claimedBy && <div><dt>Responder</dt><dd>{listing.claimedBy}</dd></div>}
        {lastTransition(listing) && <div><dt>Last update</dt><dd>{lastTransition(listing)}</dd></div>}
      </dl>
    </article>
  );
}

export function RestaurantView({ listings, loading, error, onSubmit, onRetry }: RestaurantViewProps) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<FoodCategory>("VEG");
  const [quantity, setQuantity] = useState(20);
  const [packedAt, setPackedAt] = useState(() => localInputValue(new Date()));
  const [deadline, setDeadline] = useState(() => localInputValue(new Date(Date.now() + 45 * 60_000)));
  const [safetyAccepted, setSafetyAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const active = useMemo(
    () => listings.filter((item) => ["AVAILABLE", "CLAIMED", "PICKED_UP"].includes(item.status)),
    [listings]
  );
  const completed = useMemo(
    () => listings.filter((item) => ["DELIVERED", "CANCELLED", "EXPIRED"].includes(item.status)),
    [listings]
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors: FieldErrors = {};
    const packedDate = new Date(packedAt);
    const deadlineDate = new Date(deadline);
    if (!description.trim()) errors.description = "Describe the food being offered.";
    if (!Number.isFinite(quantity) || quantity <= 0) errors.quantity = "Enter a positive meal count.";
    if (Number.isNaN(packedDate.getTime())) errors.packedAt = "Enter a valid packed time.";
    if (Number.isNaN(deadlineDate.getTime()) || deadlineDate.getTime() <= Date.now()) {
      errors.deadline = "Pickup deadline must be in the future.";
    }
    if (!safetyAccepted) errors.safety = "Confirm the donor safety declaration.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      await onSubmit({
        restaurantId: DEFAULT_RESTAURANT.id,
        restaurantName: DEFAULT_RESTAURANT.name,
        foodDescription: description.trim(),
        quantityMeals: quantity,
        foodCategory: category,
        latitude: DEFAULT_RESTAURANT.latitude,
        longitude: DEFAULT_RESTAURANT.longitude,
        packedAt: packedDate.toISOString(),
        pickupDeadline: deadlineDate.toISOString()
      });
      setDescription("");
      setSafetyAccepted(false);
      setPackedAt(localInputValue(new Date()));
      setDeadline(localInputValue(new Date(Date.now() + 45 * 60_000)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="restaurant-grid">
      <section className="panel form-panel" aria-labelledby="create-heading">
        <div className="section-header">
          <div>
            <h1 id="create-heading">Create listing</h1>
            <p>{DEFAULT_RESTAURANT.name} · {DEFAULT_RESTAURANT.area}</p>
          </div>
        </div>

        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="food-description">Food description</label>
            <textarea
              id="food-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={fieldErrors.description ? "description-error" : undefined}
              placeholder="For example, packed rice and dal meals"
            />
            {fieldErrors.description && <span className="field-error" id="description-error">{fieldErrors.description}</span>}
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="food-category">Category</label>
              <select id="food-category" value={category} onChange={(event) => setCategory(event.target.value as FoodCategory)}>
                <option value="VEG">Vegetarian</option>
                <option value="NON_VEG">Non-vegetarian</option>
                <option value="PACKAGED">Packaged</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="meal-count">Meal count</label>
              <input
                id="meal-count"
                type="number"
                min="1"
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
                aria-invalid={Boolean(fieldErrors.quantity)}
              />
              {fieldErrors.quantity && <span className="field-error">{fieldErrors.quantity}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="packed-at">Packed at</label>
              <input id="packed-at" type="datetime-local" value={packedAt} onChange={(event) => setPackedAt(event.target.value)} />
              {fieldErrors.packedAt && <span className="field-error">{fieldErrors.packedAt}</span>}
            </div>
            <div className="field">
              <label htmlFor="pickup-deadline">Pickup deadline</label>
              <input id="pickup-deadline" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
              {fieldErrors.deadline && <span className="field-error">{fieldErrors.deadline}</span>}
            </div>
          </div>

          <label className="check-field">
            <input type="checkbox" checked={safetyAccepted} onChange={(event) => setSafetyAccepted(event.target.checked)} />
            <span>I confirm this is unserved surplus food and the pickup window reflects our handling requirements.</span>
          </label>
          {fieldErrors.safety && <span className="field-error safety-error">{fieldErrors.safety}</span>}

          <button className="button primary submit-button" type="submit" disabled={submitting}>
            {submitting ? "Publishing…" : "Publish listing"}
          </button>
        </form>
      </section>

      <section className="panel history-panel" aria-labelledby="history-heading">
        <div className="section-header">
          <div>
            <h2 id="history-heading">Your listings</h2>
            <p>Current pickup progress and completed records.</p>
          </div>
        </div>
        {error && <div className="inline-error">{error}<button type="button" onClick={onRetry}>Retry</button></div>}
        {loading && !listings.length ? <div className="skeleton-list" aria-label="Loading listings"><i /><i /><i /></div> : (
          <>
            <div className="history-group">
              <h3>Active listings</h3>
              {active.length ? active.map((item) => <ListingRow key={item.id} listing={item} />) : <p className="empty-copy">No active listings.</p>}
            </div>
            <div className="history-group">
              <h3>Closed listings</h3>
              {completed.length ? completed.map((item) => <ListingRow key={item.id} listing={item} />) : <p className="empty-copy">No completed listings yet.</p>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
