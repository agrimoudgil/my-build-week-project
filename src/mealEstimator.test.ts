import { describe, expect, it } from "vitest";
import type { ParsedMeal } from "./aiMealTypes";
import { estimateParsedMeal } from "./mealEstimator";

const parsed = (items: ParsedMeal["items"], overrides: Partial<ParsedMeal> = {}): ParsedMeal => ({
  items,
  mealType: "breakfast",
  overallConfidence: "high",
  needsClarification: false,
  clarificationQuestion: null,
  ...overrides,
});

describe("estimateParsedMeal", () => {
  it("calculates separate idli and sambhar rows from the curated catalogue", () => {
    const result = estimateParsedMeal(parsed([
      { canonicalName: "idli", displayName: "Idli", quantity: 2, unit: "pieces", preparation: "steamed", confidence: "high" },
      { canonicalName: "sambhar", displayName: "Sambhar", quantity: 1, unit: "katori", preparation: "regular", confidence: "high" },
    ]));
    expect(result.items).toMatchObject([
      { dishName: "Idli", calorieEstimate: 120 },
      { dishName: "Sambar", calorieEstimate: 120 },
    ]);
    expect(result.calorieEstimate).toBe(240);
  });

  it("keeps cold coffee distinct from tea", () => {
    const result = estimateParsedMeal(parsed([
      { canonicalName: "cold coffee", displayName: "Cold coffee", quantity: 1, unit: "cup", preparation: "milk and sugar", confidence: "medium" },
    ], { overallConfidence: "medium" }));
    expect(result.items[0].dishName).toBe("Cold coffee");
    expect(result.items[0].assumption).toContain("without ice cream");
  });

  it("does not silently map an unknown item", () => {
    const result = estimateParsedMeal(parsed([
      { canonicalName: "mystery curry", displayName: "Mystery curry", quantity: 1, unit: "bowl", preparation: "", confidence: "low" },
    ], { overallConfidence: "low" }));
    expect(result.items).toEqual([]);
    expect(result.clarification?.question).toContain("Mystery curry");
  });
});
