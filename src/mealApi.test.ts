import { describe, expect, it, vi } from "vitest";
import { suggestMealType } from "./aiMealTypes";
import { analyzeMealText } from "./mealApi";

const aiPayload = {
  parsed: {
    items: [
      { canonicalName: "idli", displayName: "Idli", quantity: 2, unit: "pieces", preparation: "steamed", confidence: "high" },
      { canonicalName: "sambar", displayName: "Sambar", quantity: 1, unit: "katori", preparation: "regular", confidence: "high" },
    ],
    mealType: "breakfast",
    overallConfidence: "high",
    needsClarification: false,
    clarificationQuestion: null,
  },
  usdaMatches: [],
};

describe("analyzeMealText", () => {
  it.each([
    ["2026-09-02T00:30:00.000Z", "breakfast"],
    ["2026-09-02T07:00:00.000Z", "lunch"],
    ["2026-09-02T11:30:00.000Z", "snack"],
    ["2026-09-02T15:00:00.000Z", "dinner"],
    ["2026-09-01T22:00:00.000Z", "dinner"],
  ])("assigns %s to %s in Asia/Kolkata", (iso, expected) => {
    expect(suggestMealType(new Date(iso))).toBe(expected);
  });
  it("uses a validated AI interpretation as the primary path", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(aiPayload), { status: 200, headers: { "Content-Type": "application/json" } }));
    const result = await analyzeMealText("2 idli with sambhar", { aiEnabled: true, fetcher });
    expect(result.source).toBe("ai");
    expect(result.estimate.items.map((item) => item.dishName)).toEqual(["Idli", "Sambar"]);
    expect(fetcher).toHaveBeenCalledWith("/api/parse-meal", expect.objectContaining({ method: "POST" }));
  });

  it.each([
    ["AI error", vi.fn().mockResolvedValue(new Response("{}", { status: 502 }))],
    ["invalid schema", vi.fn().mockResolvedValue(new Response(JSON.stringify({ parsed: { items: "bad" }, usdaMatches: [] }), { status: 200 }))],
    ["network failure", vi.fn().mockRejectedValue(new Error("offline"))],
  ])("falls back locally on %s", async (_name, fetcher) => {
    const result = await analyzeMealText("half bowl rice", { aiEnabled: true, fetcher });
    expect(result.source).toBe("local");
    expect(result.estimate.items[0]).toMatchObject({ dishName: "Rice", portion: "half katori", calorieEstimate: 105 });
  });

  it("uses local parsing without making a request when AI is disabled", async () => {
    const fetcher = vi.fn();
    const result = await analyzeMealText("2 idlis with sambar", { aiEnabled: false, fetcher });
    expect(result.source).toBe("local");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
