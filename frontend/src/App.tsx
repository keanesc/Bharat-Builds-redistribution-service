import { useEffect, useMemo, useState } from "react";
import type { CreateListingRequest, Role, SurplusListing } from "../../shared/src/types.js";
import { DEMO_ACTORS } from "../../shared/src/api-contracts.js";
import { claimListing, createListing, getListings } from "./api.js";

const demoLocation = { latitude: 12.9352, longitude: 77.6245 };

function minutesRemaining(deadline: string): number {
  return Math.max(0, Math.round((new Date(deadline).getTime() - Date.now()) / 60_000));
}

function App() {
  const [role, setRole] = useState<Role>("RESPONDER");
  const [actorId, setActorId] = useState<string>(DEMO_ACTORS.responderA);
  const [listings, setListings] = useState<SurplusListing[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ description: "Packed rice and dal meals", quantity: "20" });

  const refresh = async () => {
    try {
      setError("");
      setListings(await getListings(actorId));
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to load listings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5_000);
    return () => window.clearInterval(interval);
  }, [actorId]);

  const availableCount = useMemo(() => listings.filter((listing) => listing.status === "AVAILABLE").length, [listings]);

  const updateRole = (nextRole: Role) => {
    setRole(nextRole);
    setActorId(nextRole === "RESTAURANT" ? DEMO_ACTORS.restaurant : nextRole === "ADMIN" ? DEMO_ACTORS.admin : DEMO_ACTORS.responderA);
  };

  const submitListing = async () => {
    const input: CreateListingRequest = {
      restaurantId: DEMO_ACTORS.restaurant,
      restaurantName: "Koramangala Kitchen",
      foodDescription: form.description,
      quantityMeals: Number(form.quantity),
      foodCategory: "VEG",
      ...demoLocation,
      packedAt: new Date().toISOString(),
      pickupDeadline: new Date(Date.now() + 45 * 60_000).toISOString()
    };
    await createListing(actorId, input);
    await refresh();
  };

  const claim = async (listing: SurplusListing) => {
    try {
      setError("");
      await claimListing(actorId, listing.id);
      await refresh();
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "Unable to claim listing");
    }
  };

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Bengaluru food rescue network</p>
          <h1>RescueRadius</h1>
          <p className="subtitle">Match safe surplus meals with responders before the pickup window closes.</p>
        </div>
        <div className="hero-stat"><strong>{availableCount}</strong><span>available now</span></div>
      </header>

      <section className="toolbar" aria-label="Demo controls">
        <label>View as
          <select value={role} onChange={(event) => updateRole(event.target.value as Role)}>
            <option value="RESPONDER">Responder</option>
            <option value="RESTAURANT">Restaurant</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        <button className="secondary" onClick={() => void refresh()}>Refresh</button>
        <span className="polling">Polling every 5 seconds</span>
      </section>

      {role === "RESTAURANT" && (
        <section className="panel create-panel">
          <div><p className="eyebrow">Restaurant mode</p><h2>Post safe surplus</h2></div>
          <div className="form-row">
            <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} aria-label="Food description" />
            <input type="number" min="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} aria-label="Quantity in meals" />
            <button onClick={() => void submitListing()}>Publish listing</button>
          </div>
        </section>
      )}

      <section className="content-grid">
        <div className="map-panel">
          <div className="map-grid">
            <span className="radius-ring" />
            {listings.map((listing, index) => <span key={listing.id} className={`map-pin pin-${index % 5}`} title={listing.foodDescription} />)}
            <div className="map-label">10 km rescue radius</div>
          </div>
          <div className="map-footer"><span className="legend-dot available" /> Available <span className="legend-dot claimed" /> Claimed <span className="legend-dot urgent" /> Expiring soon</div>
        </div>

        <div className="list-panel">
          <div className="section-heading"><div><p className="eyebrow">Live feed</p><h2>Nearby surplus</h2></div><span className="count-badge">{listings.length}</span></div>
          {loading && <p className="muted">Loading listings...</p>}
          {error && <p className="error">{error}</p>}
          {!loading && !listings.length && <p className="muted">No active listings in this radius.</p>}
          <div className="listing-list">
            {listings.map((listing) => {
              const remaining = minutesRemaining(listing.pickupDeadline);
              return <article className="listing-card" key={listing.id}>
                <div className="listing-top"><div><span className="food-tag">{listing.foodCategory}</span><h3>{listing.foodDescription}</h3><p>{listing.restaurantName}</p></div><strong>{listing.quantityMeals}<small> meals</small></strong></div>
                <div className="listing-meta"><span>{remaining} min left</span><span>{listing.status.replace("_", " ")}</span></div>
                {role === "RESPONDER" && listing.status === "AVAILABLE" && <button onClick={() => void claim(listing)}>Claim pickup</button>}
              </article>;
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
