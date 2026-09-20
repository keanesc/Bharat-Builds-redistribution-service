import React from "react";
import type { Role } from "../../../shared/src/types.js";
import { DEMO_RESPONDERS, DEMO_RESTAURANTS } from "../mock.js";
import { RefreshCw, HeartHandshake, Utensils, Shield, ChevronDown } from "lucide-react";

interface NavbarProps {
  role: Role;
  actorId: string;
  onRoleChange: (role: Role) => void;
  onActorChange: (actorId: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  demoMode: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  role,
  actorId,
  onRoleChange,
  onActorChange,
  onRefresh,
  isRefreshing,
  demoMode
}) => {
  return (
    <header className="navbar-header">
      <div className="navbar-top-row">
        {/* Brand identity */}
        <div className="brand-lockup">
          <img src="/logo.jpg" alt="RescueRadius" className="brand-logo-img" />
          <div>
            <h1 className="brand-title">RescueRadius</h1>
            <p className="brand-tagline">Surplus food dispatch · <span className="brand-city">ಬೆಂಗಳೂರು</span></p>
          </div>
        </div>

        {/* Minimal controls */}
        <div className="navbar-status-group">
          <button
            type="button"
            className="navbar-refresh-btn"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh listings"
          >
            <RefreshCw size={14} className={isRefreshing ? "spin-animation" : ""} />
          </button>
        </div>
      </div>

      {/* Role Navigation & Persona Bar */}
      <div className="navbar-control-bar">
        {/* Role Tabs */}
        <div className="role-tabs-container" role="tablist" aria-label="Application Role">
          <button
            type="button"
            role="tab"
            aria-selected={role === "RESPONDER"}
            className={`role-tab-btn ${role === "RESPONDER" ? "active" : ""}`}
            onClick={() => onRoleChange("RESPONDER")}
          >
            <HeartHandshake size={15} />
            <span>Responder</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={role === "RESTAURANT"}
            className={`role-tab-btn ${role === "RESTAURANT" ? "active" : ""}`}
            onClick={() => onRoleChange("RESTAURANT")}
          >
            <Utensils size={15} />
            <span>Kitchen</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={role === "ADMIN"}
            className={`role-tab-btn ${role === "ADMIN" ? "active" : ""}`}
            onClick={() => onRoleChange("ADMIN")}
          >
            <Shield size={15} />
            <span>Admin</span>
          </button>
        </div>

        {/* Persona Selector */}
        <div className="actor-switcher-wrap">
          <select
            id="actor-select"
            className="actor-dropdown"
            value={actorId}
            onChange={(e) => onActorChange(e.target.value)}
          >
            {role === "RESPONDER" && (
              <>
                {DEMO_RESPONDERS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.capacityMeals} capacity
                  </option>
                ))}
              </>
            )}

            {role === "RESTAURANT" && (
              <>
                {DEMO_RESTAURANTS.map((rest) => (
                  <option key={rest.id} value={rest.id}>
                    {rest.name} · {rest.area}
                  </option>
                ))}
              </>
            )}

            {role === "ADMIN" && (
              <option value="admin-001">City Ops Coordinator</option>
            )}
          </select>
        </div>
      </div>
    </header>
  );
};

