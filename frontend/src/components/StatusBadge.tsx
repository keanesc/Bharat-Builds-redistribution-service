import React from "react";
import type { ListingStatus } from "../../../shared/src/types.js";
import { CheckCircle2, Clock, AlertTriangle, PackageCheck, Truck, XCircle } from "lucide-react";

interface StatusBadgeProps {
  status: ListingStatus;
  urgent?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, urgent }) => {
  switch (status) {
    case "AVAILABLE":
      return (
        <span className={`status-badge status-available ${urgent ? "status-urgent" : ""}`}>
          <Clock className="badge-icon" size={13} />
          <span>{urgent ? "Expiring Soon" : "Available"}</span>
        </span>
      );
    case "CLAIMED":
      return (
        <span className="status-badge status-claimed">
          <PackageCheck className="badge-icon" size={13} />
          <span>Claimed</span>
        </span>
      );
    case "PICKED_UP":
      return (
        <span className="status-badge status-picked-up">
          <Truck className="badge-icon" size={13} />
          <span>In Transit</span>
        </span>
      );
    case "DELIVERED":
      return (
        <span className="status-badge status-delivered">
          <CheckCircle2 className="badge-icon" size={13} />
          <span>Delivered</span>
        </span>
      );
    case "CANCELLED":
      return (
        <span className="status-badge status-cancelled">
          <XCircle className="badge-icon" size={13} />
          <span>Cancelled</span>
        </span>
      );
    case "EXPIRED":
      return (
        <span className="status-badge status-expired">
          <AlertTriangle className="badge-icon" size={13} />
          <span>Expired</span>
        </span>
      );
    default:
      return <span className="status-badge">{status}</span>;
  }
};
