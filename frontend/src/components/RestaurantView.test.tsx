// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RestaurantView } from "./RestaurantView.js";

describe("RestaurantView", () => {
  it("validates the safety declaration and submits only backend fields", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RestaurantView listings={[]} loading={false} error={null} onSubmit={onSubmit} onRetry={() => {}} />);

    fireEvent.change(screen.getByLabelText("Food description"), { target: { value: "Packed dinner meals" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish listing" }));
    expect(screen.getByText("Confirm the donor safety declaration.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Publish listing" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const payload = onSubmit.mock.calls[0]![0];
    expect(payload).toMatchObject({
      restaurantId: "restaurant-001",
      foodDescription: "Packed dinner meals",
      quantityMeals: 20,
      foodCategory: "VEG"
    });
    expect(payload).not.toHaveProperty("quantityRaw");
    expect(payload).not.toHaveProperty("quantityUnit");
  });
});
