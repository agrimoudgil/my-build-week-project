import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App, { getIndiaDateKey } from "./App";
import { interpretMeal } from "./mealParser";

const key = () => `daily-meals-v3:${getIndiaDateKey()}`;
const stored = () => JSON.parse(localStorage.getItem(key()) ?? "null");
const submitMeal = (input: string) => {
  fireEvent.change(screen.getByRole("textbox", { name: "What did you eat?" }), { target: { value: input } });
  fireEvent.click(screen.getByRole("button", { name: "Analyse meal" }));
};
const expectConfirmedTotal = (calories: number) => {
  expect(screen.getByText(`Approximately ${calories} kcal`, { selector: ".today-summary strong" })).toBeInTheDocument();
};
const expectConfirmedRange = (minimum: number, maximum: number) => {
  expect(screen.getByText(`Estimated range: ${minimum}–${maximum} kcal`, { selector: ".today-summary small" })).toBeInTheDocument();
};
const immediateReview = () => screen.getByRole("heading", { name: "Review this estimate" }).closest("section")!;

describe("Daily Meal Log V2 P0", () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it("shows the deployment proof message", () => {
    render(<App />);
    expect(screen.getByText("Built for thoughtful meal tracking.")).toBeInTheDocument();
  });

  it("persists analyzing before awaiting confirmation and restores the pending meal", () => {
    const write = vi.spyOn(Storage.prototype, "setItem");
    const view = render(<App />);
    submitMeal("2 idlis with sambar");
    const states = write.mock.calls.map(([, value]) => { try { return JSON.parse(String(value)).meals?.at(-1)?.status; } catch { return null; } });
    expect(states).toContain("analyzing");
    expect(stored().meals[0].status).toBe("awaiting_confirmation");
    expect(screen.getByText("Awaiting review", { selector: ".section-label" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem", { name: /Dish:/ })).toHaveLength(2);
    view.unmount();
    render(<App />);
    expect(screen.getByRole("heading", { name: "Idli" })).toBeInTheDocument();
    expect(screen.getByText("1 meal awaiting review", { selector: "strong" })).toBeInTheDocument();
  });

  it("shows ranges and assumptions but keeps a draft out of the confirmed total", () => {
    render(<App />);
    submitMeal("half bowl rice");
    const card = screen.getByRole("heading", { name: "Review this estimate" }).closest("section")!;
    expect(within(card).getByText("Approximately 105 kcal", { selector: ".item-energy strong" })).toBeInTheDocument();
    expect(within(card).getByText("Estimated range: 92–118 kcal")).toBeInTheDocument();
    expect(within(card).getByText("How this was estimated")).toBeInTheDocument();
    expect(screen.getByText("Approximately 0 kcal", { selector: ".today-summary strong" })).toBeInTheDocument();
  });

  it("confirms a meal, updates only the confirmed total, and shows success", () => {
    render(<App />);
    submitMeal("1 katori rice");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(stored().meals[0].status).toBe("confirmed");
    expect(screen.getByText("Approximately 210 kcal", { selector: ".today-summary strong" })).toBeInTheDocument();
    expect(screen.getByText("Meal confirmed.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Confirmed meals" })).toBeInTheDocument();
  });

  it("defers without blocking capture and restores the review inbox after refresh", () => {
    const view = render(<App />);
    submitMeal("1 cup chai with sugar");
    fireEvent.click(screen.getByRole("button", { name: "Review later" }));
    expect(screen.getByRole("textbox", { name: "What did you eat?" })).toBeEnabled();
    view.unmount();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Review 1 meal" }));
    expect(screen.getByRole("heading", { name: "Awaiting review" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tea" })).toBeInTheDocument();
  });

  it("recalculates a draft correction and requires confirmation", () => {
    render(<App />);
    submitMeal("1 cup chai");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Edit meal description/ }), { target: { value: "2 cups chai" } });
    fireEvent.click(screen.getByRole("button", { name: "Recalculate" }));
    expect(screen.getByText("Approximately 180 kcal", { selector: ".item-energy strong" })).toBeInTheDocument();
    expect(stored().meals[0].status).toBe("awaiting_confirmation");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(stored().meals[0].status).toBe("confirmed");
  });

  it("excludes a confirmed meal and range as soon as its correction becomes pending, including after refresh", () => {
    const view = render(<App />);
    submitMeal("1 cup chai");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    const originalId = stored().meals[0].id;
    fireEvent.click(screen.getByRole("button", { name: "Meal options for Tea" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Edit meal description/ }), { target: { value: "2 cups chai" } });
    fireEvent.click(screen.getByRole("button", { name: "Recalculate" }));
    expectConfirmedTotal(0);
    expectConfirmedRange(0, 0);
    expect(stored().meals).toHaveLength(1);
    expect(stored().meals[0]).toMatchObject({ id: originalId, status: "awaiting_confirmation", calorieEstimate: 180 });
    view.unmount();
    render(<App />);
    expectConfirmedTotal(0);
    expectConfirmedRange(0, 0);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(stored().meals[0].status).toBe("confirmed");
    expectConfirmedTotal(180);
  });

  it("soft-deletes after confirmation and restores the complete meal after refresh", () => {
    const view = render(<App />);
    submitMeal("1 katori dal");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    fireEvent.click(screen.getByRole("button", { name: "Meal options for Dal" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete meal" }));
    expect(stored().meals[0].status).toBe("deleted");
    expect(screen.getByText("Approximately 0 kcal", { selector: ".today-summary strong" })).toBeInTheDocument();
    view.unmount();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(stored().meals[0].status).toBe("confirmed");
    expect(screen.getByText("Approximately 180 kcal", { selector: ".today-summary strong" })).toBeInTheDocument();
  });

  it("restores a deleted pending meal with its state and ordering", () => {
    const view = render(<App />);
    submitMeal("1 cup chai");
    fireEvent.click(within(immediateReview()).getByRole("button", { name: "Review later" }));
    submitMeal("half bowl rice");
    fireEvent.click(within(immediateReview()).getByRole("button", { name: "Review later" }));
    const before = stored().meals;
    fireEvent.click(screen.getByRole("button", { name: "Review 2 meals" }));
    const chaiEntry = screen.getByRole("heading", { name: "Tea" }).closest("li.meal-entry") as HTMLElement;
    fireEvent.click(within(chaiEntry).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(chaiEntry).getByRole("button", { name: "Delete meal" }));
    expect(stored().meals[0].status).toBe("deleted");
    view.unmount();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(stored().meals).toEqual(before);
  });

  it("asks at most one clarification and supports both choice and mixed-thali recovery", () => {
    render(<App />);
    submitMeal("some rice");
    expect(screen.getByText("How much rice was it?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Half katori" }));
    expect(stored().meals[0]).toMatchObject({ status: "awaiting_confirmation", clarificationAsked: true, calorieEstimate: 105 });
    fireEvent.click(screen.getByRole("button", { name: "Review later" }));
    submitMeal("one plate mixed thali");
    expect(screen.getByText("What were the main items in your thali?")).toBeInTheDocument();
    expect(screen.getByText(/Original entry: “one plate mixed thali”/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Describe main items" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Describe the main items and portions" }), { target: { value: "2 rotis, 1 katori dal" } });
    fireEvent.click(screen.getByRole("button", { name: "Recalculate" }));
    expect(stored().meals[1].status).toBe("awaiting_confirmation");
  });

  it("shows pending meals chronologically and advances to an empty inbox", () => {
    render(<App />);
    submitMeal("1 cup chai"); fireEvent.click(screen.getByRole("button", { name: "Review later" }));
    submitMeal("1 katori dal");
    fireEvent.click(within(screen.getByRole("heading", { name: "Review this estimate" }).closest("section")!).getByRole("button", { name: "Review later" }));
    fireEvent.click(screen.getByRole("button", { name: "Review 2 meals" }));
    const entries = screen.getAllByRole("listitem").filter((item) => item.classList.contains("meal-entry"));
    expect(within(entries[0]).getByRole("heading", { name: "Tea" })).toBeInTheDocument();
    fireEvent.click(within(entries[0]).getByRole("button", { name: "Confirm" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete meal" }));
    expect(screen.getByRole("heading", { name: "Everything is reviewed" })).toBeInTheDocument();
  });

  it("blocks finishing for pending meals, then records explicit completion and reopens after mutation", () => {
    render(<App />);
    submitMeal("1 cup chai"); fireEvent.click(screen.getByRole("button", { name: "Review later" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish today’s log" }));
    expect(screen.getByText("1 meal needs attention before you finish.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to today" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish today’s log" }));
    expect(screen.getByText("Have you logged everything you ate and drank today?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Not yet" }));
    expect(stored().completedAt).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Finish today’s log" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, complete my day" }));
    expect(stored().completedAt).toEqual(expect.any(String));
    expect(stored().events.at(-1).name).toBe("Complete Calorie-Tracked Day");
    submitMeal("1 apple");
    expect(stored().completedAt).toBeNull();
    expect(screen.getByRole("button", { name: "Finish today’s log" })).toBeInTheDocument();
  });

  it("uses the Asia/Kolkata calendar date around UTC midnight", () => {
    expect(getIndiaDateKey(new Date("2026-09-01T20:00:00.000Z"))).toBe("2026-09-02");
    expect(getIndiaDateKey(new Date("2026-09-01T17:00:00.000Z"))).toBe("2026-09-01");
  });

  it("migrates the old pendingEdit shape into one current pending meal", () => {
    const view = render(<App />);
    submitMeal("1 cup chai");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    const oldDay = stored();
    const updated = interpretMeal("2 cups chai");
    oldDay.meals[0].pendingEdit = {
      items: updated.items,
      calorieEstimate: updated.calorieEstimate,
      calorieMin: updated.calorieMin,
      calorieMax: updated.calorieMax,
      assumptions: updated.assumptions,
      confidence: updated.confidence,
      description: "2 cups chai",
    };
    localStorage.setItem(key(), JSON.stringify(oldDay));
    view.unmount();
    render(<App />);
    expect(stored().meals).toHaveLength(1);
    expect(stored().meals[0]).toMatchObject({ status: "awaiting_confirmation", description: "2 cups chai", calorieEstimate: 180 });
    expect(stored().meals[0].pendingEdit).toBeUndefined();
    expectConfirmedTotal(0);
  });

  it("persists failed analysis with the explicit failed status", () => {
    render(<App />);
    submitMeal("Agrim");
    expect(screen.getByRole("alert")).toHaveTextContent("couldn’t recognise");
    expect(stored().meals[0].status).toBe("failed");
  });

  it("states explicit milk and sugar assumptions for two cups of chai", () => {
    render(<App />);
    submitMeal("2 cups chai with sugar");
    expect(within(immediateReview()).getByText("Approximately 180 kcal", { selector: ".item-energy strong" })).toBeInTheDocument();
    expect(within(immediateReview()).getByText(/100 ml milk and 2 teaspoons sugar per cup/i)).toBeInTheDocument();
  });

  it("hides a redundant single-item subtotal and shows a combined multi-item total", () => {
    render(<App />);
    submitMeal("half bowl rice");
    expect(within(immediateReview()).queryByText("Combined meal total")).not.toBeInTheDocument();
    fireEvent.click(within(immediateReview()).getByRole("button", { name: "Review later" }));
    submitMeal("2 idli with sambhar");
    expect(within(immediateReview()).getByText("Combined meal total")).toBeInTheDocument();
  });

  it("stores manual meal categories and groups confirmed meals", () => {
    render(<App />);
    submitMeal("1 cup chai");
    fireEvent.change(within(immediateReview()).getByRole("combobox", { name: "Meal category for Tea" }), { target: { value: "lunch" } });
    fireEvent.click(within(immediateReview()).getByRole("button", { name: "Confirm" }));
    expect(stored().meals[0].mealType).toBe("lunch");
    expect(screen.getByRole("heading", { name: "Lunch" })).toBeInTheDocument();
  });

  it("exposes one meaningful accessible status for each action", () => {
    render(<App />);
    submitMeal("1 cup chai");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Meal added for review.");
    fireEvent.click(within(immediateReview()).getByRole("button", { name: "Review later" }));
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Saved for review later.");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Meal confirmed.");
  });

  it("disables an empty review action and labels pending counts accurately", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "No meals pending" })).toBeDisabled();
    submitMeal("1 cup chai");
    expect(screen.getByRole("button", { name: "Review 1 meal" })).toBeEnabled();
    fireEvent.click(within(immediateReview()).getByRole("button", { name: "Review later" }));
    submitMeal("half bowl rice");
    expect(screen.getByRole("button", { name: "Review 2 meals" })).toBeEnabled();
  });

  it("passes the complete required P0 acceptance sequence", () => {
    const firstView = render(<App />);

    submitMeal("2 idlis with sambar");
    expect(stored().meals[0].status).toBe("awaiting_confirmation");
    expectConfirmedTotal(0);
    fireEvent.click(within(immediateReview()).getByRole("button", { name: "Review later" }));
    fireEvent.click(screen.getByRole("button", { name: "Review 1 meal" }));
    expect(screen.getByRole("heading", { name: "Idli" })).toBeInTheDocument();
    expectConfirmedTotal(0);
    fireEvent.click(screen.getByRole("button", { name: "Back to today" }));

    submitMeal("half bowl rice");
    expect(within(immediateReview()).getByText("half katori")).toBeInTheDocument();
    fireEvent.click(within(immediateReview()).getByRole("button", { name: "Confirm" }));
    expectConfirmedTotal(105);

    fireEvent.click(screen.getByRole("button", { name: "Review 1 meal" }));
    const idliInboxEntry = screen.getByRole("heading", { name: "Idli" }).closest("li.meal-entry") as HTMLElement;
    fireEvent.click(within(idliInboxEntry).getByRole("button", { name: "Confirm" }));
    expectConfirmedTotal(345);
    fireEvent.click(screen.getByRole("button", { name: "Back to today" }));

    const idliEntry = screen.getByRole("heading", { name: "Idli" }).closest("li.meal-entry") as HTMLElement;
    const idliId = stored().meals.find((meal: { description: string }) => meal.description.includes("idli")).id;
    fireEvent.click(within(idliEntry).getByRole("button", { name: "Meal options for Idli and Sambar" }));
    fireEvent.click(within(idliEntry).getByRole("menuitem", { name: "Edit" }));
    fireEvent.change(within(idliEntry).getByRole("textbox", { name: /Edit meal description/ }), { target: { value: "3 idlis with sambar" } });
    fireEvent.click(within(idliEntry).getByRole("button", { name: "Recalculate" }));
    expectConfirmedTotal(105);
    expectConfirmedRange(92, 118);
    expect(stored().meals.filter((meal: { id: string }) => meal.id === idliId)).toHaveLength(1);
    fireEvent.click(within(immediateReview()).getByRole("button", { name: "Confirm" }));
    expectConfirmedTotal(405);
    expectConfirmedRange(334, 476);

    const riceEntry = screen.getByRole("heading", { name: "Rice" }).closest("li.meal-entry") as HTMLElement;
    fireEvent.click(within(riceEntry).getByRole("button", { name: "Meal options for Rice" }));
    fireEvent.click(within(riceEntry).getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(within(riceEntry).getByRole("button", { name: "Delete meal" }));
    expectConfirmedTotal(300);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("heading", { name: "Rice" })).toBeInTheDocument();
    expectConfirmedTotal(405);

    fireEvent.click(screen.getByRole("button", { name: "Finish today’s log" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, complete my day" }));
    expect(stored().completedAt).toEqual(expect.any(String));
    firstView.unmount();
    render(<App />);
    expectConfirmedTotal(405);
    expect(screen.getByText("Day completed")).toBeInTheDocument();

    submitMeal("1 apple");
    expect(stored().completedAt).toBeNull();
    expect(screen.getByRole("button", { name: "Finish today’s log" })).toBeInTheDocument();
    fireEvent.click(within(immediateReview()).getByRole("button", { name: "Review later" }));
    submitMeal("mixed thali");
    expect(screen.getByText("What were the main items in your thali?")).toBeInTheDocument();
    fireEvent.click(within(immediateReview()).getByRole("button", { name: "Review later" }));
    submitMeal("2 cups chai with sugar");
    expect(within(immediateReview()).getByText("Approximately 180 kcal", { selector: ".item-energy strong" })).toBeInTheDocument();
    expect(within(immediateReview()).getByText(/100 ml milk and 2 teaspoons sugar per cup/i)).toBeInTheDocument();
  });
});
