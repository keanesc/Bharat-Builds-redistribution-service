import { useEffect, useMemo, useState, useCallback } from "react";
import type { CreateListingRequest, Role, SurplusListing } from "../../shared/src/types.js";
import { DEMO_ACTORS } from "../../shared/src/api-contracts.js";
import {
  cancelListing,
  claimListing,
  createListing,
  deliverListing,
  demoMode,
  getListings,
  pickupListing
} from "./api.js";
import { DEMO_RESPONDERS, DEMO_RESTAURANTS, DEFAULT_RESPONDER, DEFAULT_RESTAURANT } from "./mock.js";
import { Navbar } from "./components/Navbar.js";
import { BengaluruMap } from "./components/BengaluruMap.js";
import { RestaurantView } from "./components/RestaurantView.js";
import { ResponderView } from "./components/ResponderView.js";
import { AdminDashboard } from "./components/AdminDashboard.js";
import { NotificationToast, type ToastMessage } from "./components/NotificationToast.js";

export function App() {
  const [role, setRole] = useState<Role>("RESPONDER");
  const [actorId, setActorId] = useState<string>(DEMO_ACTORS.responderA);
  const [listings, setListings] = useState<SurplusListing[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [ { id, ...toast }, ...prev.slice(0, 4) ]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refresh = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setIsRefreshing(true);
      const data = await getListings(actorId);
      setListings(data);
    } catch (err) {
      if (!quiet) {
        addToast({
          type: "error",
          title: "Failed to load listings",
          description: err instanceof Error ? err.message : "Unable to reach server"
        });
      }
    } finally {
      if (!quiet) setIsRefreshing(false);
    }
  }, [actorId, addToast]);

  // Polling every 5 seconds
  useEffect(() => {
    void refresh(false);
    const interval = window.setInterval(() => {
      void refresh(true);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const handleRoleChange = (nextRole: Role) => {
    setRole(nextRole);
    if (nextRole === "RESPONDER") {
      setActorId(DEFAULT_RESPONDER.id);
    } else if (nextRole === "RESTAURANT") {
      setActorId(DEFAULT_RESTAURANT.id);
    } else {
      setActorId(DEMO_ACTORS.admin);
    }
  };


  const handleActorChange = (nextActorId: string) => {
    setActorId(nextActorId);
  };

  const handleSubmitListing = async (input: CreateListingRequest) => {
    try {
      const created = await createListing(actorId, input);
      addToast({
        type: "success",
        title: "Surplus Listing Published!",
        description: `${created.quantityMeals} meals broadcasted to nearby responders in Bengaluru.`
      });
      await refresh(true);
      setSelectedListingId(created.id);
    } catch (err) {
      addToast({
        type: "error",
        title: "Failed to publish listing",
        description: err instanceof Error ? err.message : "Error creating surplus"
      });
      throw err;
    }
  };

  const handleClaim = async (listing: SurplusListing, quantity?: number) => {
    try {
      const updated = await claimListing(actorId, listing.id, quantity);
      addToast({
        type: "success",
        title: "Rescue Claimed Successfully!",
        description: `You are assigned to collect ${updated.quantityMeals} meals from ${updated.restaurantName}.`
      });
      await refresh(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Claim failed";
      const isConflict = msg.toLowerCase().includes("conflict") || msg.toLowerCase().includes("no longer available");
      addToast({
        type: isConflict ? "conflict" : "error",
        title: isConflict ? "Claim Conflict Detected" : "Unable to Claim",
        description: msg
      });
      await refresh(true); // refresh to sync state without blowing away the feed
    }
  };

  const handlePickup = async (listing: SurplusListing) => {
    try {
      const updated = await pickupListing(actorId, listing.id);
      addToast({
        type: "success",
        title: "Pickup Confirmed!",
        description: `Packages collected from ${updated.restaurantName}. Transit to shelter started.`
      });
      await refresh(true);
    } catch (err) {
      addToast({
        type: "error",
        title: "Pickup Confirmation Failed",
        description: err instanceof Error ? err.message : "Error updating pickup state"
      });
    }
  };

  const handleDeliver = async (listing: SurplusListing) => {
    try {
      const updated = await deliverListing(actorId, listing.id);
      addToast({
        type: "success",
        title: "🎉 Rescue Completed & Delivered!",
        description: `${updated.quantityMeals} meals safely distributed to the community.`
      });
      await refresh(true);
    } catch (err) {
      addToast({
        type: "error",
        title: "Delivery Failed",
        description: err instanceof Error ? err.message : "Error completing delivery"
      });
    }
  };

  const handleCancel = async (listing: SurplusListing) => {
    try {
      await cancelListing(actorId, listing.id);
      addToast({
        type: "info",
        title: "Claim Released",
        description: "The listing has been released back into the pool for other volunteers."
      });
      await refresh(true);
    } catch (err) {
      addToast({
        type: "error",
        title: "Cancellation Failed",
        description: err instanceof Error ? err.message : "Error cancelling claim"
      });
    }
  };

  const currentResponder = useMemo(() => {
    return DEMO_RESPONDERS.find((r) => r.id === actorId) ?? DEMO_RESPONDERS[0];
  }, [actorId]);

  return (
    <>
      {/* Ambient Background — floating food particles + radar sweep */}
      <div className="ambient-bg" aria-hidden="true">
        <div className="ambient-gradient-drift" />
        <div className="food-particle fp-tiffin fp-1" />
        <div className="food-particle fp-leaf fp-2" />
        <div className="food-particle fp-grain fp-3" />
        <div className="food-particle fp-heart fp-4" />
        <div className="food-particle fp-spoon fp-5" />
        <div className="food-particle fp-dot fp-6" />
        <div className="food-particle fp-tiffin fp-7" />
        <div className="food-particle fp-leaf fp-8" />
        <div className="food-particle fp-grain fp-9" />
        <div className="food-particle fp-heart fp-10" />
        <div className="food-particle fp-spoon fp-11" />
        <div className="food-particle fp-dot fp-12" />
      </div>

      <div className="app-layout">
      {/* Toast Notification Layer */}
      <NotificationToast toasts={toasts} onDismiss={dismissToast} />

      {/* Top Navbar & Role Switcher */}
      <Navbar
        role={role}
        actorId={actorId}
        onRoleChange={handleRoleChange}
        onActorChange={handleActorChange}
        onRefresh={() => void refresh(false)}
        isRefreshing={isRefreshing}
        demoMode={demoMode}
      />

      {/* Main Content Area */}
      <main className="main-content-wrapper">
        {/* Responder View: Interactive Map + Rescue Feed */}
        {role === "RESPONDER" && (
          <div className="responder-layout-grid">
            <div className="map-column">
              <BengaluruMap
                listings={listings}
                selectedListingId={selectedListingId}
                onSelectListing={setSelectedListingId}
                currentResponder={currentResponder}
              />
            </div>
            <div className="feed-column">
              <ResponderView
                actorId={actorId}
                listings={listings}
                selectedListingId={selectedListingId}
                onSelectListing={setSelectedListingId}
                onClaim={handleClaim}
                onPickup={handlePickup}
                onDeliver={handleDeliver}
                onCancel={handleCancel}
              />
            </div>
          </div>
        )}

        {/* Restaurant View: Posting Wizard & Live Dispatches */}
        {role === "RESTAURANT" && (
          <div className="restaurant-layout-wrapper">
            <RestaurantView
              actorId={actorId}
              listings={listings}
              onSubmitListing={handleSubmitListing}
              onSelectListing={setSelectedListingId}
              onPickup={handlePickup}
            />
          </div>
        )}

        {/* Admin View: Telemetry & Impact Dashboard */}
        {role === "ADMIN" && (
          <div className="admin-layout-wrapper">
            <AdminDashboard
              actorId={actorId}
              listings={listings}
              onRefresh={() => void refresh(true)}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-inner">
          <p className="footer-credit">
            <strong>RescueRadius</strong> • Expiry-Aware Food Redistribution System for Bengaluru • FSSAI Safe Surplus Protocol
          </p>
          <div className="footer-tags">
            <span>Dynamic Haversine Dispatch</span>
            <span>Single-Winner Atomic Claims</span>
            <span>Deterministic Verification</span>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}

export default App;

