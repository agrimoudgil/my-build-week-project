import { describe, expect, it, vi } from "vitest";
import { analyzeServerMeal, describeMealPhoto, MealAnalysisError } from "./meal-service.js";

describe("server meal analysis", () => {
  it("reuses the local deterministic meal estimator when AI is unconfigured", async () => {
    const result = await analyzeServerMeal("half bowl rice", { environment: {} });
    expect(result.estimate).toMatchObject({ calorieEstimate: 105, calorieMin: 92, calorieMax: 118 });
    expect(result.estimate.items[0]).toMatchObject({ dishName: "Rice", portion: "half katori" });
  });

  it("turns an image into meal text without requesting calories or storage", async () => {
    const create = vi.fn().mockResolvedValue({ output_text: "2 idlis with sambar" });
    const result = await describeMealPhoto(
      { bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" },
      { client: { responses: { create } } as never, environment: { OPENAI_MODEL: "test-model" } },
    );
    expect(result).toBe("2 idlis with sambar");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: "test-model", store: false }));
  });

  it("reports an analysis failure instead of returning an empty estimate", async () => {
    await expect(analyzeServerMeal("not a meal", { environment: {} })).rejects.toBeInstanceOf(MealAnalysisError);
  });
});
