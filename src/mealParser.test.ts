import { describe, expect, it } from "vitest";
import { interpretMeal } from "./mealParser";

describe("interpretMeal", () => {
  it.each([
    ["half bowl rice", "half katori", 105], ["half katori rice", "half katori", 105],
    ["one bowl rice", "1 katori", 210], ["one and a half bowls rice", "1.5 katoris", 315],
    ["two bowls rice", "2 katoris", 420], ["small bowl rice", "small katori", 158],
    ["medium bowl rice", "medium katori", 210], ["large bowl rice", "large katori", 315],
    ["one piece idli", "1 piece", 60], ["three pieces idli", "3 pieces", 180],
    ["one cup chai with sugar", "1 cup", 90], ["2 cups chai with sugar", "2 cups", 180],
    ["one handful rice", "1 handful", 105], ["one plate rice", "1 plate", 420],
  ])("parses %s", (input, portion, calories) => {
    expect(interpretMeal(input).items[0]).toMatchObject({ portion, calorieEstimate: calories });
  });

  it("identifies both items in 2 idlis with sambar", () => {
    expect(interpretMeal("2 idlis with sambar").items).toMatchObject([
      { dishName: "Idli", portion: "2 pieces", calorieEstimate: 120 },
      { dishName: "Sambar", portion: "1 katori", calorieEstimate: 120 },
    ]);
  });

  it("accepts the sambhar spelling variant", () => {
    expect(interpretMeal("2 idli with sambhar").items.map((item) => item.dishName)).toEqual(["Idli", "Sambar"]);
  });

  it("recognizes noodles but asks which type when generic", () => {
    const result = interpretMeal("1 plate noodles");
    expect(result.items[0]).toMatchObject({ dishName: "Noodles", portion: "1 plate" });
    expect(result.clarification?.question).toBe("What type of noodles was it?");
  });

  it("keeps cold coffee distinct from tea and asks about preparation", () => {
    const result = interpretMeal("one cold coffee");
    expect(result.items[0].dishName).toBe("Cold coffee");
    expect(result.items.some((item) => item.dishName === "Tea")).toBe(false);
    expect(result.clarification?.question).toContain("ice cream");
  });

  it("preserves every quantity in the required mixed meal", () => {
    expect(interpretMeal("2 rotis, 1 katori dal and 1 bowl rice").items).toMatchObject([
      { dishName: "Roti", portion: "2 rotis", calorieEstimate: 220 },
      { dishName: "Dal", portion: "1 katori", calorieEstimate: 180 },
      { dishName: "Rice", portion: "1 katori", calorieEstimate: 210 },
    ]);
  });

  it("uses deterministic uncertainty based on input specificity", () => {
    expect(interpretMeal("1 katori rice")).toMatchObject({ calorieEstimate: 210, calorieMin: 185, calorieMax: 235, confidence: "high" });
    expect(interpretMeal("rice")).toMatchObject({ calorieEstimate: 210, calorieMin: 147, calorieMax: 273, confidence: "low" });
    expect(interpretMeal("large bowl rice")).toMatchObject({ calorieEstimate: 315, calorieMin: 252, calorieMax: 378, confidence: "medium" });
  });

  it("offers one recoverable clarification for an unrecognized mixed thali", () => {
    expect(interpretMeal("one plate mixed thali")).toMatchObject({
      items: [], error: null, clarification: { question: "What were the main items in your thali?", allowDescription: true },
    });
  });

  it("offers one high-impact choice for an unclear rice portion", () => {
    const result = interpretMeal("some rice");
    expect(result.clarification?.question).toBe("How much rice was it?");
    expect(result.clarification?.options.map((option) => option.label)).toEqual(["Half katori", "One katori", "More"]);
  });

  it("fails without assigning calories when no food is recognized", () => {
    expect(interpretMeal("Agrim")).toMatchObject({ items: [], calorieEstimate: 0, clarification: null });
    expect(interpretMeal("Agrim").error).toContain("couldn’t recognise");
  });

  it("states the assumed milk and sugar amount for chai", () => {
    const result = interpretMeal("2 cups chai with sugar");
    expect(result.items[0]).toMatchObject({ portion: "2 cups", calorieEstimate: 180 });
    expect(result.items[0].assumption).toContain("100 ml milk and 2 teaspoons sugar per cup");
  });
});
