import React, { useEffect } from "react";
import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from "lucide-react";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "conflict" | "info";
  title: string;
  description?: string;
}

interface NotificationToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ toasts, onDismiss }) => {
  useEffect(() => {
    if (!toasts.length || !toasts[0]) return;
    const firstToastId = toasts[0].id;
    const timer = setTimeout(() => {
      onDismiss(firstToastId);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toasts, onDismiss]);


  if (!toasts.length) return null;

  return (
    <aside className="toast-container" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => {
        return (
          <div key={toast.id} className={`toast-card toast-${toast.type}`}>
            <div className="toast-icon-wrap">
              {toast.type === "success" && <CheckCircle size={18} className="toast-icon-success" />}
              {toast.type === "error" && <AlertCircle size={18} className="toast-icon-error" />}
              {toast.type === "conflict" && <AlertTriangle size={18} className="toast-icon-conflict" />}
              {toast.type === "info" && <Info size={18} className="toast-icon-info" />}
            </div>
            <div className="toast-content">
              <h4 className="toast-title">{toast.title}</h4>
              {toast.description && <p className="toast-desc">{toast.description}</p>}
            </div>
            <button
              type="button"
              className="toast-close-btn"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </aside>
  );
};
