import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MealOptionsMenu from "./MealOptionsMenu";

describe("MealOptionsMenu", () => {
  it("supports keyboard navigation, Escape, and focus restoration", async () => {
    render(<MealOptionsMenu mealName="Rice" onEdit={vi.fn()} onDelete={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Meal options for Rice" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("closes on outside click and restores trigger focus", () => {
    render(<><MealOptionsMenu mealName="Dal" onEdit={vi.fn()} onDelete={vi.fn()} /><button type="button">Outside</button></>);
    const trigger = screen.getByRole("button", { name: "Meal options for Dal" });
    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
