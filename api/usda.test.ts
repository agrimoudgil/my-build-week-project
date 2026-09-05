import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearUsdaCacheForTests, resolveUsdaMatches } from "./usda.js";

const unknownItem = {
  canonicalName: "quinoa flakes",
  displayName: "Quinoa flakes",
  quantity: 1,
  unit: "serving",
  preparation: "unspecified",
  confidence: "medium" as const,
};

describe("USDA fallback", () => {
  beforeEach(clearUsdaCacheForTests);

  it("uses no network without a key and caches a trustworthy match", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ foods: [{ description: "Quinoa flakes", servingSize: 40, servingSizeUnit: "g", foodNutrients: [{ nutrientName: "Energy", unitName: "KCAL", value: 370 }] }] }),
    });

    expect(await resolveUsdaMatches([unknownItem], undefined, fetcher as never)).toEqual([]);
    const first = await resolveUsdaMatches([unknownItem], "test-key", fetcher as never);
    const second = await resolveUsdaMatches([unknownItem], "test-key", fetcher as never);

    expect(first[0]).toMatchObject({ canonicalName: "quinoa flakes", caloriesPerUnit: 148 });
    expect(second).toEqual(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
