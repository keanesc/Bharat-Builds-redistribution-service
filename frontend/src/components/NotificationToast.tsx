import { CheckCircle2, CircleAlert, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  type: "success" | "error";
  title: string;
  description?: string;
}

interface NotificationToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function NotificationToast({ toasts, onDismiss }: NotificationToastProps) {
  if (!toasts.length) return null;
  return (
    <aside className="toast-region" aria-live="polite" aria-label="Action notifications">
      {toasts.map((toast) => (
        <div className={`toast ${toast.type}`} key={toast.id}>
          {toast.type === "success" ? <CheckCircle2 size={19} /> : <CircleAlert size={19} />}
          <div>
            <strong>{toast.title}</strong>
            {toast.description && <p>{toast.description}</p>}
          </div>
          <button type="button" aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}>
            <X size={16} />
          </button>
        </div>
      ))}
    </aside>
  );
}
