import { describe, expect, it, vi } from "vitest";
import { parseMealOnServer, SafeHttpError } from "./parse-meal.js";

const validParsed = {
  items: [{ canonicalName: "idli", displayName: "Idli", quantity: 2, unit: "pieces", preparation: "steamed", confidence: "high" }],
  mealType: "breakfast",
  overallConfidence: "high",
  needsClarification: false,
  clarificationQuestion: null,
};

describe("parseMealOnServer", () => {
  it("uses Structured Outputs settings without storing the response", async () => {
    const parse = vi.fn().mockResolvedValue({ output_parsed: validParsed });
    const result = await parseMealOnServer("2 idli", { OPENAI_MODEL: "test-model" }, { responses: { parse } } as never);
    expect(result.parsed).toEqual(validParsed);
    expect(parse).toHaveBeenCalledWith(expect.objectContaining({ model: "test-model", store: false, text: { format: expect.anything() } }));
  });

  it("uses gpt-5.6-luna by default", async () => {
    const parse = vi.fn().mockResolvedValue({ output_parsed: validParsed });
    await parseMealOnServer("2 idli", {}, { responses: { parse } } as never);
    expect(parse).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-5.6-luna" }));
  });

  it("rejects missing, oversized, unconfigured, invalid, and failed requests safely", async () => {
    await expect(parseMealOnServer("", { OPENAI_API_KEY: "unused" })).rejects.toMatchObject({ status: 400, code: "invalid_input" });
    await expect(parseMealOnServer("x".repeat(501), { OPENAI_API_KEY: "unused" })).rejects.toMatchObject({ status: 413, code: "input_too_long" });
    await expect(parseMealOnServer("rice", {})).rejects.toMatchObject({ status: 503, code: "ai_unconfigured" });
    const invalid = { responses: { parse: vi.fn().mockResolvedValue({ output_parsed: { items: "bad" } }) } } as never;
    await expect(parseMealOnServer("rice", {}, invalid)).rejects.toBeInstanceOf(SafeHttpError);
    const failed = { responses: { parse: vi.fn().mockRejectedValue(new Error("secret upstream detail")) } } as never;
    await expect(parseMealOnServer("rice", {}, failed)).rejects.toMatchObject({ status: 502, code: "ai_unavailable" });
  });
});
