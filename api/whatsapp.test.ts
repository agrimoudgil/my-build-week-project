import twilio from "twilio";
import { Readable } from "node:stream";
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

  it.each([
    ["parsed object", { ...fields, Body: "2 idli with sambhar" }],
    ["URL-encoded string", new URLSearchParams({ ...fields, Body: "2 idli with sambhar" }).toString()],
    ["Buffer", Buffer.from(new URLSearchParams({ ...fields, Body: "2 idli with sambhar" }).toString())],
  ])("accepts a Vercel %s body and returns a non-empty TwiML Message", async (_label, body) => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", authToken);
    vi.stubEnv("TWILIO_WEBHOOK_URL", webhookUrl);
    const signedFields = { ...fields, Body: "2 idli with sambhar" };
    const response = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn() };

    await handler({
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": twilio.getExpectedTwilioSignature(authToken, webhookUrl, signedFields),
      },
      body,
    } as never, response as never);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith(
      expect.stringContaining("<Message>Received: 2 idli with sambhar</Message>"),
    );
    vi.unstubAllEnvs();
  });

  it("reads an unread raw form stream", async () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", authToken);
    vi.stubEnv("TWILIO_WEBHOOK_URL", webhookUrl);
    const signedFields = { ...fields, Body: "2 idli with sambhar" };
    const request = Readable.from([new URLSearchParams(signedFields).toString()]) as Readable & Record<string, unknown>;
    request.method = "POST";
    request.headers = {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": twilio.getExpectedTwilioSignature(authToken, webhookUrl, signedFields),
    };
    const response = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn() };

    await handler(request as never, response as never);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith(
      expect.stringContaining("<Message>Received: 2 idli with sambhar</Message>"),
    );
    vi.unstubAllEnvs();
  });

  it("does not reread the stream when request.body is populated", async () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", authToken);
    vi.stubEnv("TWILIO_WEBHOOK_URL", webhookUrl);
    const signedFields = { ...fields, Body: "2 idli with sambhar" };
    const response = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn() };
    const request = {
      method: "POST",
      headers: { "x-twilio-signature": twilio.getExpectedTwilioSignature(authToken, webhookUrl, signedFields) },
      body: signedFields,
      async *[Symbol.asyncIterator]() {
        throw new Error("stream must not be read");
      },
    };

    await handler(request as never, response as never);

    expect(response.status).toHaveBeenCalledWith(200);
    vi.unstubAllEnvs();
  });

  it("logs only safe webhook diagnostics", async () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", authToken);
    vi.stubEnv("TWILIO_WEBHOOK_URL", webhookUrl);
    const signedFields = { ...fields, Body: "2 idli with sambhar" };
    const signature = twilio.getExpectedTwilioSignature(authToken, webhookUrl, signedFields);
    const response = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn() };
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await handler({
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": signature },
      body: signedFields,
    } as never, response as never);

    expect(info).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledWith({
      method: "POST",
      contentType: "application/x-www-form-urlencoded",
      hasBody: true,
      signatureValid: true,
      responseHasMessage: true,
    });
    const logged = JSON.stringify(info.mock.calls);
    expect(logged).not.toContain(signedFields.Body);
    expect(logged).not.toContain(signedFields.From);
    expect(logged).not.toContain(signedFields.To);
    expect(logged).not.toContain(signedFields.MessageSid);
    expect(logged).not.toContain(authToken);
    expect(logged).not.toContain(signature);

    info.mockRestore();
    vi.unstubAllEnvs();
  });

  it("escapes user text in XML", () => {
    const escapedFields = { ...fields, Body: `<paneer & "rice">` };
    const result = handleWhatsAppWebhook(signedPost(escapedFields));
    expect(result.xml).toContain("Received: &lt;paneer &amp; &quot;rice&quot;&gt;");
    expect(result.xml).not.toContain(escapedFields.Body);
  });

  it("returns a useful TwiML message for a signed POST with no Body", () => {
    const bodyWithoutMessage = { From: fields.From, To: fields.To, MessageSid: fields.MessageSid };
    const result = handleWhatsAppWebhook(signedPost(bodyWithoutMessage));
    expect(result.status).toBe(200);
    expect(result.xml).toContain("<Message>");
    expect(result.xml).not.toContain("<Response></Response>");
  });

  it("trims Body before writing the TwiML response", () => {
    const paddedFields = { ...fields, Body: "  2 idli with sambhar  " };
    const result = handleWhatsAppWebhook(signedPost(paddedFields));
    expect(result.status).toBe(200);
    expect(result.xml).toContain("<Message>Received: 2 idli with sambhar</Message>");
  });

  it("rejects an invalid signature", () => {
    const result = handleWhatsAppWebhook({ ...signedPost(), signature: "invalid" });
    expect(result.status).toBe(403);
    expect(result.xml).toContain("<Response></Response>");
  });
});
