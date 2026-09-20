import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ResponderProfile, SurplusListing } from "../../../shared/src/types.js";

interface BengaluruMapProps {
  listings: SurplusListing[];
  selectedListingId: string | null;
  responder: ResponderProfile;
  onSelectListing: (id: string) => void;
}

const markerColor: Record<SurplusListing["status"], string> = {
  AVAILABLE: "#197149",
  CLAIMED: "#2563eb",
  PICKED_UP: "#7c3aed",
  DELIVERED: "#4b5563",
  CANCELLED: "#9ca3af",
  EXPIRED: "#9ca3af"
};

export function BengaluruMap({ listings, selectedListingId, responder, onSelectListing }: BengaluruMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const listingLayerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef(new Map<string, L.CircleMarker>());

  useEffect(() => {
    if (!containerRef.current) return;
    const center: L.LatLngExpression = [responder.latitude, responder.longitude];
    const map = L.map(containerRef.current, { center, zoom: 12, zoomControl: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);
    L.circle(center, {
      radius: 10_000,
      color: "#197149",
      fillColor: "#197149",
      fillOpacity: 0.025,
      weight: 1,
      dashArray: "5 5"
    }).addTo(map);
    L.circleMarker(center, {
      radius: 7,
      color: "#ffffff",
      weight: 2,
      fillColor: "#111827",
      fillOpacity: 1
    }).bindTooltip("Responder location").addTo(map);
    listingLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      listingLayerRef.current = null;
      markersRef.current.clear();
    };
  }, [responder.id, responder.latitude, responder.longitude]);

  useEffect(() => {
    const layer = listingLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    markersRef.current.clear();

    listings.forEach((listing) => {
      const marker = L.circleMarker([listing.latitude, listing.longitude], {
        radius: selectedListingId === listing.id ? 10 : 8,
        color: "#ffffff",
        weight: 2,
        fillColor: markerColor[listing.status],
        fillOpacity: 1
      });
      const popup = document.createElement("div");
      popup.className = "map-popup";
      const title = document.createElement("strong");
      title.textContent = listing.foodDescription;
      const details = document.createElement("span");
      details.textContent = `${listing.restaurantName} · ${listing.quantityMeals} meals`;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "View listing";
      button.addEventListener("click", () => onSelectListing(listing.id));
      popup.append(title, details, button);
      marker.bindPopup(popup).on("click", () => onSelectListing(listing.id)).addTo(layer);
      markersRef.current.set(listing.id, marker);
    });
  }, [listings, onSelectListing, selectedListingId]);

  useEffect(() => {
    if (!selectedListingId) return;
    const marker = markersRef.current.get(selectedListingId);
    if (marker && mapRef.current) {
      marker.openPopup();
      mapRef.current.panTo(marker.getLatLng());
    }
  }, [selectedListingId]);

  return (
    <section className="map-panel" aria-labelledby="map-heading">
      <div className="section-header compact">
        <div>
          <h2 id="map-heading">Pickup map</h2>
          <p>Available listings and your active work within 10 km.</p>
        </div>
        <div className="map-legend" aria-label="Map legend">
          <span><i className="dot available" />Available</span>
          <span><i className="dot active" />Your task</span>
        </div>
      </div>
      <div ref={containerRef} className="map-canvas" aria-label="Bengaluru pickup map" />
    </section>
  );
}
