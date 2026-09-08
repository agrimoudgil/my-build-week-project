import twilio from "twilio";
import { describe, expect, it, vi } from "vitest";
import handler, { handleWhatsAppWebhook } from "./whatsapp.js";

const webhookUrl = "https://example.com/api/whatsapp";
const authToken = "test-auth-token";
const fields = {
  Body: "half bowl rice",
  From: "whatsapp:+911234567890",
  To: "whatsapp:+14155238886",
  MessageSid: "SM123",
};

function signedPost(body: Record<string, string> = fields) {
  return {
    method: "POST",
    signature: twilio.getExpectedTwilioSignature(authToken, webhookUrl, body),
    webhookUrl,
    fields: body,
    authToken,
  };
}

describe("Twilio WhatsApp Stage 1 webhook", () => {
  it("returns a JSON health check for GET", async () => {
    const response = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler({ method: "GET", headers: {} } as never, response as never);
    expect(response.setHeader).toHaveBeenCalledWith("Content-Type", "application/json");
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ ok: true });
  });

  it("returns valid TwiML for a signed form POST", () => {
    const result = handleWhatsAppWebhook(signedPost());
    expect(result.status).toBe(200);
    expect(result.xml).toContain("<Message>Received: half bowl rice</Message>");
    expect(result.xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?><Response>/);
  });

  it("accepts a URL-encoded Vercel POST and returns XML with HTTP 200", async () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", authToken);
    vi.stubEnv("TWILIO_WEBHOOK_URL", webhookUrl);
    const response = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    const signature = twilio.getExpectedTwilioSignature(authToken, webhookUrl, fields);

    await handler({
      method: "POST",
      headers: { "x-twilio-signature": signature },
      body: new URLSearchParams(fields).toString(),
    } as never, response as never);

    expect(response.setHeader).toHaveBeenCalledWith("Content-Type", "text/xml; charset=utf-8");
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith(expect.stringContaining("<Message>Received: half bowl rice</Message>"));
    vi.unstubAllEnvs();
  });

  it("escapes user text in XML", () => {
    const escapedFields = { ...fields, Body: `<paneer & "rice">` };
    const result = handleWhatsAppWebhook(signedPost(escapedFields));
    expect(result.xml).toContain("Received: &lt;paneer &amp; &quot;rice&quot;&gt;");
    expect(result.xml).not.toContain(escapedFields.Body);
  });

  it("rejects a signed POST with no Body", () => {
    const bodyWithoutMessage = { From: fields.From, To: fields.To, MessageSid: fields.MessageSid };
    const result = handleWhatsAppWebhook(signedPost(bodyWithoutMessage));
    expect(result.status).toBe(400);
    expect(result.xml).toContain("<Response></Response>");
  });

  it("rejects an invalid signature", () => {
    const result = handleWhatsAppWebhook({ ...signedPost(), signature: "invalid" });
    expect(result.status).toBe(403);
    expect(result.xml).toContain("<Response></Response>");
  });
});
