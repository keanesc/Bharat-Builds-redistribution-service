import React, { useEffect, useRef } from "react";
import type { ResponderProfile, SurplusListing } from "../../../shared/src/types.js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Layers, Crosshair } from "lucide-react";

interface BengaluruMapProps {
  listings: SurplusListing[];
  selectedListingId: string | null;
  onSelectListing: (id: string) => void;
  currentResponder?: ResponderProfile;
}

function calculateDriveTimeMins(lat1: number, lon1: number, lat2: number, lon2: number): { distanceKm: number; driveMins: number } {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = Math.round(R * c * 10) / 10;
  // Bengaluru traffic heuristic: ~3 mins per km + 4 min base
  const driveMins = Math.round(distanceKm * 2.8 + 4);
  return { distanceKm, driveMins };
}

function createTiffinDabbaHtml(
  tierFill: string,
  meals: number,
  isCritical: boolean,
  isSelected: boolean
): string {
  const pulseHtml = isCritical ? `<div class="leaflet-dabba-pulse"></div>` : "";
  const selectRingHtml = isSelected ? `<div class="leaflet-dabba-select-ring" style="border-color:${tierFill}"></div>` : "";

  return `
    <div class="leaflet-tiffin-marker-container ${isSelected ? "selected" : ""}">
      ${selectRingHtml}
      ${pulseHtml}
      <div class="leaflet-tiffin-svg-wrap">
        <svg width="34" height="42" viewBox="-17 -22 34 44" class="leaflet-tiffin-svg">
          <defs>
            <filter id="dabba-drop-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2.5" stdDeviation="2" flood-color="#1C2420" flood-opacity="0.35" />
            </filter>
          </defs>
          <!-- Handle -->
          <path d="M -9 -14 C -9 -21, 9 -21, 9 -14" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" />
          <g filter="url(#dabba-drop-shadow)">
            <!-- Top Tier -->
            <rect x="-11" y="-14" width="22" height="7" rx="2" fill="${tierFill}" stroke="#FFFFFF" stroke-width="1.5" />
            <!-- Middle Tier -->
            <rect x="-11" y="-6" width="22" height="7" rx="2" fill="${tierFill}" stroke="#FFFFFF" stroke-width="1.5" />
            <!-- Bottom Tier -->
            <rect x="-11" y="2" width="22" height="8" rx="2.5" fill="${tierFill}" stroke="#FFFFFF" stroke-width="1.5" />
            <!-- Latches -->
            <line x1="-11" y1="-14" x2="-11" y2="9" stroke="#FFFFFF" stroke-width="1.2" />
            <line x1="11" y1="-14" x2="11" y2="9" stroke="#FFFFFF" stroke-width="1.2" />
          </g>
          <!-- Meals Count -->
          <text x="0" y="0" text-anchor="middle" font-size="8.5" font-weight="900" fill="#FFFFFF" font-family="'Space Grotesk', monospace">
            ${meals}
          </text>
        </svg>
      </div>
    </div>
  `;
}

export const BengaluruMap: React.FC<BengaluruMapProps> = ({
  listings,
  selectedListingId,
  onSelectListing,
  currentResponder
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());
  const [mapTileStyle, setMapTileStyle] = React.useState<"osm" | "carto">("osm");

  const centerLat = currentResponder?.latitude ?? 12.9352;
  const centerLng = currentResponder?.longitude ?? 77.6245;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 12,
      zoomControl: false,
      scrollWheelZoom: true
    });

    // Direct OpenStreetMap Standard Tile API
    const initialTile = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    tileLayerRef.current = initialTile;

    // Add minimal zoom controls in top right
    L.control.zoom({ position: "topright" }).addTo(map);

    // 10 KM Dispatch Corridor Perimeter Circle
    const circle10Km = L.circle([centerLat, centerLng], {
      radius: 10000,
      color: "#1A6B52",
      fillColor: "#1A6B52",
      fillOpacity: 0.04,
      weight: 2,
      dashArray: "8, 6"
    }).addTo(map);
    circle10Km.bindTooltip("10 KM Dispatch Corridor Boundary", { permanent: false, direction: "top" });

    // 5 KM Priority Inner Zone Circle (Fast-Response matching)
    const circle5Km = L.circle([centerLat, centerLng], {
      radius: 5000,
      color: "#D97706",
      fillColor: "#D97706",
      fillOpacity: 0.05,
      weight: 1.5,
      dashArray: "4, 4"
    }).addTo(map);
    circle5Km.bindTooltip("5 KM Priority Dispatch Zone (<15m drive)", { permanent: false, direction: "top" });

    // Base Station Pin for Responder
    const baseIcon = L.divIcon({
      className: "leaflet-base-station-marker",
      html: `
        <div class="base-station-pin-wrap">
          <div class="base-pulse-ring"></div>
          <div class="base-station-core"></div>
          <span class="base-station-tag">YOUR BASE (${currentResponder?.role ?? "NGO"})</span>
        </div>
      `,
      iconSize: [120, 36],
      iconAnchor: [60, 18]
    });

    L.marker([centerLat, centerLng], { icon: baseIcon, zIndexOffset: 1000 }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = layerGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [centerLat, centerLng, currentResponder?.role]);

  // Update Markers when listings change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    const layerGroup = markersLayerRef.current;
    layerGroup.clearLayers();
    markerMapRef.current.clear();

    listings.forEach((listing) => {
      const remainingMs = new Date(listing.pickupDeadline).getTime() - Date.now();
      const remainingMins = Math.max(0, Math.round(remainingMs / 60_000));
      const isExpired = remainingMs <= 0 || listing.status === "EXPIRED";
      const isSelected = selectedListingId === listing.id;

      // Urgency Color Palette
      let tierFill = "#D97706"; // Turmeric / Safe (>45m)
      let isCritical = false;

      if (listing.status === "CLAIMED") {
        tierFill = "#2563EB"; // Royal Cobalt
      } else if (listing.status === "PICKED_UP") {
        tierFill = "#4F46E5"; // Indigo
      } else if (listing.status === "DELIVERED") {
        tierFill = "#059669"; // Forest Emerald
      } else if (isExpired || listing.status === "CANCELLED") {
        tierFill = "#9CA3AF";
      } else if (remainingMins <= 25) {
        tierFill = "#DC2626"; // Terracotta Red
        isCritical = true;
      } else if (remainingMins <= 45) {
        tierFill = "#EA580C"; // Bangalore Amber
      }

      const { distanceKm, driveMins } = calculateDriveTimeMins(
        centerLat,
        centerLng,
        listing.latitude,
        listing.longitude
      );

      // Composite transit signal
      let signalBadge = { text: `✓ Safe — ${driveMins}m drive, ${remainingMins}m left`, color: "#059669", bg: "#ECFDF5" };
      if (isExpired) {
        signalBadge = { text: "✕ Window Expired", color: "#DC2626", bg: "#FEF2F2" };
      } else if (driveMins >= remainingMins) {
        signalBadge = { text: `⚠️ High Risk — ${driveMins}m drive vs ${remainingMins}m left`, color: "#DC2626", bg: "#FEF2F2" };
      } else if (remainingMins - driveMins <= 15) {
        signalBadge = { text: `⚡ Tight — ${driveMins}m drive, ${remainingMins}m left`, color: "#D97706", bg: "#FFFBEB" };
      }

      const iconHtml = createTiffinDabbaHtml(tierFill, listing.quantityMeals, isCritical, isSelected);

      const customIcon = L.divIcon({
        className: "custom-tiffin-marker-node",
        html: iconHtml,
        iconSize: [34, 42],
        iconAnchor: [17, 21],
        popupAnchor: [0, -22]
      });

      const marker = L.marker([listing.latitude, listing.longitude], {
        icon: customIcon,
        zIndexOffset: isSelected ? 500 : isCritical ? 300 : 100
      });

      // Streamlined anchored popup with single composite status line
      const isPriority = distanceKm <= 5;
      const statusIcon = isExpired ? "✕" : driveMins >= remainingMins ? "🔴" : remainingMins - driveMins <= 15 ? "🟠" : "🟢";
      const compositeSummary = listing.status === "AVAILABLE"
        ? `${statusIcon} ${remainingMins}m left · ${driveMins}m drive${isPriority ? " · ⚡ Priority" : ""}`
        : `${listing.status}`;

      const popupContent = document.createElement("div");
      popupContent.className = "leaflet-custom-popup-content";
      const rawQtyHtml = listing.quantityRaw
        ? `<p class="popup-raw-qty">${listing.quantityRaw}</p>`
        : "";
      popupContent.innerHTML = `
        <div class="popup-top-tier">
          <span class="popup-composite-tag" style="color: ${tierFill}">
            ${compositeSummary}
          </span>
          <span class="popup-meals-badge">feeds ${listing.quantityMeals}</span>
        </div>
        <h4 class="popup-food-desc">${listing.foodDescription}</h4>
        ${rawQtyHtml}
        <p class="popup-restaurant-sub">📍 ${listing.restaurantName} · ${distanceKm} km</p>
        <button type="button" class="popup-focus-btn">View in Feed</button>
      `;

      const focusBtn = popupContent.querySelector(".popup-focus-btn");
      if (focusBtn) {
        focusBtn.addEventListener("click", () => {
          onSelectListing(listing.id);
        });
      }

      marker.bindPopup(popupContent, {
        closeButton: true,
        className: "leaflet-tiffin-popup-box",
        maxWidth: 260
      });

      marker.on("click", () => {
        onSelectListing(listing.id);
      });

      marker.addTo(layerGroup);
      markerMapRef.current.set(listing.id, marker);

      if (isSelected) {
        marker.openPopup();
      }
    });
  }, [listings, selectedListingId, onSelectListing, centerLat, centerLng]);

  // Pan to selected listing when selectedListingId changes
  useEffect(() => {
    if (!selectedListingId || !mapInstanceRef.current) return;
    const targetMarker = markerMapRef.current.get(selectedListingId);
    if (targetMarker) {
      targetMarker.openPopup();
      mapInstanceRef.current.panTo(targetMarker.getLatLng(), { animate: true, duration: 0.5 });
    }
  }, [selectedListingId]);

  const toggleMapTileStyle = () => {
    const nextStyle = mapTileStyle === "osm" ? "carto" : "osm";
    setMapTileStyle(nextStyle);
    if (!mapInstanceRef.current || !tileLayerRef.current) return;

    mapInstanceRef.current.removeLayer(tileLayerRef.current);
    const newTile =
      nextStyle === "osm"
        ? L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          })
        : L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO',
            subdomains: "abcd",
            maxZoom: 19
          });
    newTile.addTo(mapInstanceRef.current);
    tileLayerRef.current = newTile;
  };

  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([centerLat, centerLng], 12, { animate: true, duration: 0.8 });
  };

  return (
    <div className="bengaluru-map-container">
      {/* Map Control Header Strip */}
      <div className="map-header-bar">
        <div className="map-title-wrap">
          <span className="tiffin-icon-badge">🥫</span>
          <span className="map-title">Bengaluru Dispatch Radar</span>
          <span className="map-radar-badge">OPENSTREETMAP API</span>
        </div>
        <div className="map-actions">
          <button
            type="button"
            className="map-toggle-btn"
            onClick={toggleMapTileStyle}
            title="Switch OpenStreetMap Tile Layer"
          >
            <Layers size={13} />
            <span>{mapTileStyle === "osm" ? "OSM Standard" : "OSM Muted"}</span>
          </button>
          <button
            type="button"
            className="map-toggle-btn"
            onClick={handleRecenter}
            title="Recenter to your base"
          >
            <Crosshair size={13} />
            <span>Recenter</span>
          </button>
        </div>
      </div>

      {/* Real Leaflet Map Container */}
      <div className="map-real-leaflet-wrapper">
        <div ref={mapContainerRef} className="leaflet-map-canvas" />
      </div>

      {/* Map Urgency Legend Strip */}
      <div className="map-legend-bar">
        <div className="legend-item">
          <span className="legend-dabba dabba-turmeric" />
          <span>&gt;45m Safe</span>
        </div>
        <div className="legend-item">
          <span className="legend-dabba dabba-amber" />
          <span>25-45m Window</span>
        </div>
        <div className="legend-item">
          <span className="legend-dabba dabba-terracotta" />
          <span>&lt;25m Urgent</span>
        </div>
        <div className="legend-item">
          <span className="legend-dabba dabba-claimed" />
          <span>Claimed</span>
        </div>
        <div className="legend-item">
          <span className="legend-dabba dabba-delivered" />
          <span>Delivered</span>
        </div>
        <div className="map-disclaimer">
          <span>* 10km corridor & 5km priority zone</span>
        </div>
      </div>
    </div>
  );
};
