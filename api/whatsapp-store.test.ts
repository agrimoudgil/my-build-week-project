import { describe, expect, it, vi } from "vitest";
import { saveWhatsAppMeal, whatsappUserId } from "./whatsapp-store.js";

const analysis = {
  sourceText: "half bowl rice",
  estimate: {
    items: [{ dishName: "Rice", portion: "half katori", calorieEstimate: 105, calorieMin: 92, calorieMax: 118, assumption: "Assumes half katori of rice.", confidence: "high" as const }],
    calorieEstimate: 105, calorieMin: 92, calorieMax: 118,
    assumptions: ["Assumes half katori of rice."], confidence: "high" as const, clarification: null, error: null,
  },
};

describe("WhatsApp meal storage", () => {
  it("stores a complete pending meal under a hashed sender identifier", async () => {
    const writer = vi.fn().mockResolvedValue({});
    const record = await saveWhatsAppMeal("whatsapp:+911234567890", analysis, {
      writer, now: new Date("2026-09-03T10:00:00.000Z"), id: "meal-1",
    });
    expect(record).toMatchObject({ userId: whatsappUserId("whatsapp:+911234567890"), status: "awaiting_confirmation", calorieEstimate: 105 });
    expect(JSON.parse(writer.mock.calls[0][1])).toEqual(record);
    expect(writer.mock.calls[0][0]).not.toContain("+911234567890");
  });

  it("surfaces storage failures", async () => {
    const writer = vi.fn().mockRejectedValue(new Error("storage down"));
    await expect(saveWhatsAppMeal("whatsapp:+911234567890", analysis, { writer })).rejects.toThrow("storage down");
  });
});
