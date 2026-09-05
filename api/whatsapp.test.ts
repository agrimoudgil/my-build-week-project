import twilio from "twilio";
import { describe, expect, it, vi } from "vitest";
import { handleWhatsAppWebhook } from "./whatsapp.js";

const url = "https://example.com/api/whatsapp";
const authToken = "test-auth-token";
const baseFields = { From: "whatsapp:+911234567890", Body: "half bowl rice", NumMedia: "0" };
const analysis = {
  sourceText: "half bowl rice",
  estimate: {
    items: [{ dishName: "Rice", portion: "half katori", calorieEstimate: 105, calorieMin: 92, calorieMax: 118, assumption: "Assumes half katori of rice.", confidence: "high" as const }],
    calorieEstimate: 105, calorieMin: 92, calorieMax: 118,
    assumptions: ["Assumes half katori of rice."], confidence: "high" as const, clarification: null, error: null,
  },
};

const dependencies = (overrides: Partial<Parameters<typeof handleWhatsAppWebhook>[1]> = {}) => ({
  validate: () => true,
  analyzeText: vi.fn().mockResolvedValue(analysis),
  analyzePhoto: vi.fn().mockResolvedValue(analysis),
  save: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("Twilio WhatsApp webhook", () => {
  it("rejects an invalid X-Twilio-Signature", async () => {
    const result = await handleWhatsAppWebhook({ method: "POST", signature: "invalid", url, fields: baseFields, authToken }, dependencies({ validate: () => false }));
    expect(result).toEqual({ status: 403, xml: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>' });
  });

  it("validates and analyzes text input", async () => {
    const signature = twilio.getExpectedTwilioSignature(authToken, url, baseFields);
    const deps = dependencies({ validate: twilio.validateRequest });
    const result = await handleWhatsAppWebhook({ method: "POST", signature, url, fields: baseFields, authToken }, deps);
    expect(deps.analyzeText).toHaveBeenCalledWith("half bowl rice");
    expect(deps.save).toHaveBeenCalledWith(baseFields.From, analysis);
    expect(result.status).toBe(200);
  });

  it("uses the image path for one photo", async () => {
    const fields = { ...baseFields, Body: "", NumMedia: "1", MediaUrl0: "https://api.twilio.com/media/1", MediaContentType0: "image/jpeg" };
    const deps = dependencies();
    await handleWhatsAppWebhook({ method: "POST", signature: "valid", url, fields, authToken }, deps);
    expect(deps.analyzePhoto).toHaveBeenCalledWith(fields);
    expect(deps.analyzeText).not.toHaveBeenCalled();
  });

  it("explains how to recover from empty input", async () => {
    const result = await handleWhatsAppWebhook({ method: "POST", signature: "valid", url, fields: { ...baseFields, Body: "" }, authToken }, dependencies());
    expect(result.xml).toContain("Send a meal description or one clear meal photo and try again.");
  });

  it("explains how to recover when analysis fails", async () => {
    const result = await handleWhatsAppWebhook({ method: "POST", signature: "valid", url, fields: baseFields, authToken }, dependencies({ analyzeText: vi.fn().mockRejectedValue(new Error("analysis failed")) }));
    expect(result.xml).toContain("Add the main foods and portions, then try again.");
  });

  it("explains how to recover when storage fails", async () => {
    const result = await handleWhatsAppWebhook({ method: "POST", signature: "valid", url, fields: baseFields, authToken }, dependencies({ save: vi.fn().mockRejectedValue(new Error("storage failed")) }));
    expect(result.xml).toContain("I analysed the meal but couldn’t save it. Please try again.");
  });

  it("returns valid escaped TwiML with the existing calorie result", async () => {
    const result = await handleWhatsAppWebhook({ method: "POST", signature: "valid", url, fields: baseFields, authToken }, dependencies());
    expect(result.xml).toBe('<?xml version="1.0" encoding="UTF-8"?><Response><Message>Rice (half katori)\nApproximately 105 kcal\nEstimated range: 92–118 kcal\nStatus: Awaiting review</Message></Response>');
  });
});
