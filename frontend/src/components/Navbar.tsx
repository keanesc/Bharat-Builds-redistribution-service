import { RefreshCw } from "lucide-react";
import type { ResponderProfile, Role } from "../../../shared/src/types.js";

interface NavbarProps {
  role: Role;
  actorId: string;
  responders: ResponderProfile[];
  isRefreshing: boolean;
  demoMode: boolean;
  onRoleChange: (role: Role) => void;
  onActorChange: (actorId: string) => void;
  onRefresh: () => void;
}

const roles: Array<{ value: Role; label: string }> = [
  { value: "RESTAURANT", label: "Restaurant" },
  { value: "RESPONDER", label: "Responder" },
  { value: "ADMIN", label: "Admin" }
];

export function Navbar({
  role,
  actorId,
  responders,
  isRefreshing,
  demoMode,
  onRoleChange,
  onActorChange,
  onRefresh
}: NavbarProps) {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">R</span>
          <div>
            <strong>RescueRadius</strong>
            <span>Surplus food coordination</span>
          </div>
          <span className="demo-label">{demoMode ? "Local demo" : "Demo identity"}</span>
        </div>

        <nav className="role-tabs" aria-label="Application role">
          {roles.map((item) => (
            <button
              key={item.value}
              type="button"
              className={role === item.value ? "role-tab active" : "role-tab"}
              aria-current={role === item.value ? "page" : undefined}
              onClick={() => onRoleChange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          <label className="sr-only" htmlFor="actor-select">Demo actor</label>
          <select id="actor-select" value={actorId} onChange={(event) => onActorChange(event.target.value)}>
            {role === "RESPONDER" && responders.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.name}</option>
            ))}
            {role === "RESTAURANT" && <option value="restaurant-001">Koramangala Kitchen</option>}
            {role === "ADMIN" && <option value="admin-001">City operations</option>}
          </select>
          <button
            type="button"
            className="icon-button"
            aria-label="Refresh current view"
            title="Refresh"
            disabled={isRefreshing}
            onClick={onRefresh}
          >
            <RefreshCw size={17} className={isRefreshing ? "rotating" : undefined} />
          </button>
        </div>
      </div>
    </header>
  );
}
