// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getImpactDashboard } from "../api.js";
import { AdminDashboard } from "./AdminDashboard.js";

vi.mock("../api.js", () => ({ getImpactDashboard: vi.fn() }));

describe("AdminDashboard", () => {
  beforeEach(() => {
    vi.mocked(getImpactDashboard).mockResolvedValue({
      totalMealsListed: 100,
      mealsClaimed: 80,
      mealsPickedUp: 60,
      mealsDelivered: 50,
      expiredListings: 2,
      averageTimeToClaimMinutes: 7.5,
      pickupSuccessRate: 0.75
    });
  });

  it("renders metrics returned by the dashboard endpoint", async () => {
    render(<AdminDashboard actorId="admin-001" refreshKey={0} onLoadingChange={() => {}} />);
    expect(await screen.findByText("Meals listed")).toBeInTheDocument();
    expect(screen.getAllByText("100")).toHaveLength(2);
    expect(screen.getByText("7.5 min")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(getImpactDashboard).toHaveBeenCalledWith("admin-001", expect.any(AbortSignal));
  });
});
