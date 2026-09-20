import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CreateListingRequest, ResponderProfile, Role, SurplusListing } from "../../shared/src/types.js";
import { DEMO_ACTORS, DEMO_ACTOR_ROLES } from "../../shared/src/api-contracts.js";
import {
  ApiClientError,
  cancelListing,
  claimListing,
  createListing,
  deliverListing,
  demoMode,
  getListings,
  getMyListings,
  getProfiles,
  pickupListing
} from "./api.js";
import { DEFAULT_RESPONDER, DEMO_RESPONDERS } from "./mock.js";
import { Navbar } from "./components/Navbar.js";
import { NotificationToast, type ToastMessage } from "./components/NotificationToast.js";
import { RestaurantView } from "./components/RestaurantView.js";
import { ResponderView, type ResponderFilters } from "./components/ResponderView.js";
import { AdminDashboard } from "./components/AdminDashboard.js";

function replaceById(listings: SurplusListing[], updated: SurplusListing): SurplusListing[] {
  return [updated, ...listings.filter((item) => item.id !== updated.id)];
}

export function App() {
  const [role, setRole] = useState<Role>("RESPONDER");
  const [actorId, setActorId] = useState<string>(DEMO_ACTORS.responderA);
  const [profiles, setProfiles] = useState<ResponderProfile[]>(DEMO_RESPONDERS);
  const [availableListings, setAvailableListings] = useState<SurplusListing[]>([]);
  const [myListings, setMyListings] = useState<SurplusListing[]>([]);
  const [filters, setFilters] = useState<ResponderFilters>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminRefreshKey, setAdminRefreshKey] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const requestVersion = useRef(0);

  const addToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = crypto.randomUUID();
    setToasts((current) => [{ id, ...toast }, ...current].slice(0, 3));
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 5000);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getProfiles(DEMO_ACTORS.responderA, controller.signal)
      .then((items) => {
        const selectable = items.filter((profile) => DEMO_ACTOR_ROLES[profile.id] === "RESPONDER");
        if (selectable.length) setProfiles(selectable);
      })
      .catch(() => {
        // The seeded fallback keeps the role switcher usable if profile loading fails.
      });
    return () => controller.abort();
  }, []);

  const currentResponder = useMemo(
    () => profiles.find((profile) => profile.id === actorId) ?? DEFAULT_RESPONDER,
    [actorId, profiles]
  );

  const refreshRoleData = useCallback(async (quiet = false) => {
    if (role === "ADMIN") {
      setAdminRefreshKey((value) => value + 1);
      return;
    }
    const version = ++requestVersion.current;
    if (!quiet) setLoading(true);
    setError(null);
    try {
      if (role === "RESPONDER") {
        const [available, mine] = await Promise.all([
          getListings(actorId, {
            latitude: currentResponder.latitude,
            longitude: currentResponder.longitude,
            radiusKm: 10,
            ...filters
          }),
          getMyListings(actorId)
        ]);
        if (version !== requestVersion.current) return;
        setAvailableListings(available);
        setMyListings(mine);
      } else {
        const mine = await getMyListings(actorId);
        if (version !== requestVersion.current) return;
        setMyListings(mine);
        setAvailableListings([]);
      }
    } catch (reason) {
      if (version !== requestVersion.current) return;
      setError(reason instanceof Error ? reason.message : "Unable to load listings.");
    } finally {
      if (version === requestVersion.current && !quiet) setLoading(false);
    }
  }, [actorId, currentResponder.latitude, currentResponder.longitude, filters, role]);

  useEffect(() => {
    requestVersion.current += 1;
    setError(null);
    if (role === "ADMIN") return;
    void refreshRoleData(false);
    const interval = window.setInterval(() => void refreshRoleData(true), 5000);
    return () => {
      window.clearInterval(interval);
      requestVersion.current += 1;
    };
  }, [refreshRoleData, role]);

  const changeRole = (nextRole: Role) => {
    setAvailableListings([]);
    setMyListings([]);
    setLoading(true);
    setRole(nextRole);
    setActorId(
      nextRole === "RESTAURANT"
        ? DEMO_ACTORS.restaurant
        : nextRole === "ADMIN"
          ? DEMO_ACTORS.admin
          : profiles[0]?.id ?? DEMO_ACTORS.responderA
    );
    setFilters({});
  };

  const changeActor = (nextActorId: string) => {
    setAvailableListings([]);
    setMyListings([]);
    setLoading(true);
    setActorId(nextActorId);
  };

  const create = async (input: CreateListingRequest) => {
    try {
      const created = await createListing(actorId, input);
      setMyListings((current) => replaceById(current, created));
      addToast({ type: "success", title: "Listing published", description: `${created.quantityMeals} meals are now available.` });
      void refreshRoleData(true);
    } catch (reason) {
      addToast({ type: "error", title: "Could not publish listing", description: reason instanceof Error ? reason.message : undefined });
      throw reason;
    }
  };

  const claim = async (listing: SurplusListing) => {
    try {
      const updated = await claimListing(actorId, listing.id);
      setAvailableListings((current) => current.filter((item) => item.id !== listing.id));
      setMyListings((current) => replaceById(current, updated));
      addToast({ type: "success", title: "Pickup claimed", description: `${updated.quantityMeals} meals from ${updated.restaurantName}.` });
      void refreshRoleData(true);
    } catch (reason) {
      const conflict = reason instanceof ApiClientError && reason.status === 409;
      if (conflict) setAvailableListings((current) => current.filter((item) => item.id !== listing.id));
      addToast({
        type: "error",
        title: conflict ? "Listing is no longer available" : "Could not claim pickup",
        description: reason instanceof Error ? reason.message : undefined
      });
      void refreshRoleData(true);
    }
  };

  const runTransition = async (
    listing: SurplusListing,
    action: "pickup" | "deliver" | "cancel"
  ) => {
    try {
      const updated = action === "pickup"
        ? await pickupListing(actorId, listing.id)
        : action === "deliver"
          ? await deliverListing(actorId, listing.id)
          : await cancelListing(actorId, listing.id);
      setMyListings((current) => replaceById(current, updated));
      const title = action === "pickup" ? "Pickup confirmed" : action === "deliver" ? "Delivery confirmed" : "Claim cancelled";
      addToast({ type: "success", title });
      void refreshRoleData(true);
    } catch (reason) {
      addToast({
        type: "error",
        title: "Could not update listing",
        description: reason instanceof Error ? reason.message : undefined
      });
      void refreshRoleData(true);
    }
  };

  return (
    <div className="app-shell">
      <Navbar
        role={role}
        actorId={actorId}
        responders={profiles}
        isRefreshing={loading}
        demoMode={demoMode}
        onRoleChange={changeRole}
        onActorChange={changeActor}
        onRefresh={() => void refreshRoleData(false)}
      />
      <NotificationToast toasts={toasts} onDismiss={(id) => setToasts((items) => items.filter((item) => item.id !== id))} />

      <main className="page-container">
        {role === "RESTAURANT" && (
          <RestaurantView
            listings={myListings}
            loading={loading}
            error={error}
            onSubmit={create}
            onRetry={() => void refreshRoleData(false)}
          />
        )}
        {role === "RESPONDER" && (
          <ResponderView
            responder={currentResponder}
            availableListings={availableListings}
            myListings={myListings}
            filters={filters}
            loading={loading}
            error={error}
            onFiltersChange={setFilters}
            onClaim={claim}
            onPickup={(listing) => runTransition(listing, "pickup")}
            onDeliver={(listing) => runTransition(listing, "deliver")}
            onCancel={(listing) => runTransition(listing, "cancel")}
            onRetry={() => void refreshRoleData(false)}
          />
        )}
        {role === "ADMIN" && (
          <AdminDashboard actorId={actorId} refreshKey={adminRefreshKey} onLoadingChange={setLoading} />
        )}
      </main>
    </div>
  );
}

export default App;
