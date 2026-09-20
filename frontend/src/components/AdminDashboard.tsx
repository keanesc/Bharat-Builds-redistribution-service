import { useEffect, useState } from "react";
import type { ImpactDashboard } from "../../../shared/src/types.js";
import { getImpactDashboard } from "../api.js";

interface AdminDashboardProps {
  actorId: string;
  refreshKey: number;
  onLoadingChange: (loading: boolean) => void;
}

const metrics: Array<{ key: keyof ImpactDashboard; label: string; format?: "minutes" | "percent" }> = [
  { key: "totalMealsListed", label: "Meals listed" },
  { key: "mealsClaimed", label: "Meals claimed" },
  { key: "mealsPickedUp", label: "Meals picked up" },
  { key: "mealsDelivered", label: "Meals delivered" },
  { key: "expiredListings", label: "Expired listings" },
  { key: "averageTimeToClaimMinutes", label: "Average claim time", format: "minutes" },
  { key: "pickupSuccessRate", label: "Pickup success rate", format: "percent" }
];

function metricValue(value: number, format?: "minutes" | "percent"): string {
  if (format === "minutes") return `${value.toFixed(1)} min`;
  if (format === "percent") return `${Math.round(value * 100)}%`;
  return Math.round(value).toLocaleString();
}

export function AdminDashboard({ actorId, refreshKey, onLoadingChange }: AdminDashboardProps) {
  const [dashboard, setDashboard] = useState<ImpactDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    onLoadingChange(true);
    getImpactDashboard(actorId, controller.signal)
      .then(setDashboard)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to load impact metrics.");
      })
      .finally(() => {
        if (!controller.signal.aborted) onLoadingChange(false);
      });
    return () => controller.abort();
  }, [actorId, onLoadingChange, refreshKey, retryKey]);

  const total = dashboard?.totalMealsListed ?? 0;
  const stages = dashboard ? [
    { label: "Listed", value: dashboard.totalMealsListed },
    { label: "Claimed", value: dashboard.mealsClaimed },
    { label: "Picked up", value: dashboard.mealsPickedUp },
    { label: "Delivered", value: dashboard.mealsDelivered }
  ] : [];

  return (
    <section className="admin-dashboard" aria-labelledby="dashboard-heading">
      <div className="page-heading">
        <h1 id="dashboard-heading">Impact dashboard</h1>
        <p>Operational metrics calculated from listing status and history.</p>
      </div>

      {error && <div className="inline-error">{error}<button type="button" onClick={() => setRetryKey((value) => value + 1)}>Retry</button></div>}

      {!dashboard && !error ? (
        <div className="metric-grid skeleton-metrics" aria-label="Loading impact metrics">
          {metrics.map((item) => <i key={item.key} />)}
        </div>
      ) : dashboard ? (
        <>
          <div className="metric-grid">
            {metrics.map((item) => (
              <article className="metric-card" key={item.key}>
                <span>{item.label}</span>
                <strong>{metricValue(dashboard[item.key], item.format)}</strong>
              </article>
            ))}
          </div>

          <section className="panel lifecycle-panel" aria-labelledby="lifecycle-heading">
            <div className="section-header compact">
              <div><h2 id="lifecycle-heading">Meal lifecycle</h2><p>Counts reported by the impact API.</p></div>
            </div>
            {total === 0 ? <p className="empty-copy">No listing activity has been recorded.</p> : (
              <div className="lifecycle-bars">
                {stages.map((stage) => (
                  <div className="lifecycle-row" key={stage.label}>
                    <span>{stage.label}</span>
                    <div><i style={{ width: `${Math.min(100, (stage.value / total) * 100)}%` }} /></div>
                    <strong>{stage.value.toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
