import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const twilioMocks = vi.hoisted(() => ({
  createMessage: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("twilio", async (importOriginal) => {
  const actual = await importOriginal();
  const realTwilio = (actual as unknown as {
    default: {
      getExpectedTwilioSignature: (authToken: string, url: string, params: Record<string, string>) => string;
      validateRequest: (authToken: string, signature: string, url: string, params: Record<string, string>) => boolean;
    };
  }).default;
  const createClient = Object.assign(
    (...args: unknown[]) => twilioMocks.createClient(...args),
    {
      getExpectedTwilioSignature: realTwilio.getExpectedTwilioSignature,
      validateRequest: realTwilio.validateRequest,
    },
  );
  return { default: createClient };
});

import twilio from "twilio";
import handler from "./whatsapp.js";

const webhookUrl = "https://example.com/api/whatsapp";
const accountSid = "AC00000000000000000000000000000000";
const authToken = "test-auth-token";
const fields = {
  Body: "  2 idli with sambhar  ",
  From: "whatsapp:+911234567890",
  To: "whatsapp:+14155238886",
  MessageSid: "SM123",
};

function responseMock() {
  return {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
    json: vi.fn(),
  };
}

function signature(formFields: Record<string, string>) {
  return twilio.getExpectedTwilioSignature(authToken, webhookUrl, formFields);
}

async function post(body: unknown, signedFields: Record<string, string> = fields) {
  const response = responseMock();
  await handler({
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": signature(signedFields),
    },
    body,
  } as never, response as never);
  return response;
}

describe("Twilio WhatsApp Stage 1 webhook", () => {
  beforeEach(() => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", accountSid);
    vi.stubEnv("TWILIO_AUTH_TOKEN", authToken);
    vi.stubEnv("TWILIO_WEBHOOK_URL", webhookUrl);
    twilioMocks.createMessage.mockReset();
    twilioMocks.createClient.mockReset();
    twilioMocks.createMessage.mockResolvedValue({ sid: "SM-outbound" });
    twilioMocks.createClient.mockReturnValue({ messages: { create: twilioMocks.createMessage } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("keeps the GET health check unchanged", async () => {
    const response = responseMock();
    await handler({ method: "GET", headers: {} } as never, response as never);
    expect(response.setHeader).toHaveBeenCalledWith("Content-Type", "application/json");
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ ok: true });
    expect(twilioMocks.createMessage).not.toHaveBeenCalled();
  });

  it("sends exactly one outbound echo and returns empty TwiML", async () => {
    const response = await post(fields);
    expect(twilioMocks.createClient).toHaveBeenCalledWith(accountSid, authToken);
    expect(twilioMocks.createMessage).toHaveBeenCalledOnce();
    expect(twilioMocks.createMessage).toHaveBeenCalledWith({
      to: fields.From,
      from: fields.To,
      body: "Received: 2 idli with sambhar",
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.setHeader).toHaveBeenCalledWith("Content-Type", "text/xml; charset=utf-8");
    expect(response.send).toHaveBeenCalledWith('<?xml version="1.0" encoding="UTF-8"?><Response/>');
  });

  it.each([
    ["URL-encoded string", new URLSearchParams(fields).toString()],
    ["Buffer", Buffer.from(new URLSearchParams(fields).toString())],
  ])("parses a Vercel %s body before sending", async (_label, body) => {
    const response = await post(body);
    expect(twilioMocks.createMessage).toHaveBeenCalledOnce();
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("reads an unread raw form stream before sending", async () => {
    const request = Readable.from([new URLSearchParams(fields).toString()]) as Readable & Record<string, unknown>;
    request.method = "POST";
    request.headers = {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": signature(fields),
    };
    const response = responseMock();
    await handler(request as never, response as never);
    expect(twilioMocks.createMessage).toHaveBeenCalledOnce();
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("does not reread the stream when request.body is populated", async () => {
    const request = {
      method: "POST",
      headers: { "x-twilio-signature": signature(fields) },
      body: fields,
      async *[Symbol.asyncIterator]() {
        throw new Error("stream must not be read");
      },
    };
    const response = responseMock();
    await handler(request as never, response as never);
    expect(twilioMocks.createMessage).toHaveBeenCalledOnce();
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("sends nothing for an invalid signature", async () => {
    const response = responseMock();
    await handler({
      method: "POST",
      headers: { "x-twilio-signature": "invalid" },
      body: fields,
    } as never, response as never);
    expect(twilioMocks.createMessage).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
  });

  it("sends nothing when Body is missing", async () => {
    const bodyWithoutMessage = { From: fields.From, To: fields.To, MessageSid: fields.MessageSid };
    const response = await post(bodyWithoutMessage, bodyWithoutMessage);
    expect(twilioMocks.createMessage).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it.each([
    ["From", { ...fields, From: "+911234567890" }],
    ["To", { ...fields, To: "+14155238886" }],
  ])("sends nothing when %s is not a WhatsApp address", async (_label, invalidFields) => {
    const response = await post(invalidFields, invalidFields);
    expect(twilioMocks.createMessage).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("requires TWILIO_ACCOUNT_SID without sending", async () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "");
    const response = await post(fields);
    expect(twilioMocks.createMessage).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(500);
  });

  it("returns 500 and logs only Twilio error code and status when sending fails", async () => {
    twilioMocks.createMessage.mockRejectedValue({
      code: 21610,
      status: 400,
      message: fields.Body,
      moreInfo: `secret-${accountSid}-${authToken}-${fields.From}`,
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await post(fields);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(error).toHaveBeenCalledWith({ twilioErrorCode: 21610, twilioErrorStatus: 400 });
    expect(info).toHaveBeenCalledWith(expect.objectContaining({ outboundSendSucceeded: false }));
    const logged = JSON.stringify([...error.mock.calls, ...info.mock.calls]);
    for (const secret of [fields.Body, fields.From, fields.To, fields.MessageSid, accountSid, authToken]) {
      expect(logged).not.toContain(secret);
    }
  });

  it("logs only safe success diagnostics", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await post(fields);
    expect(info).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledWith({
      method: "POST",
      contentType: "application/x-www-form-urlencoded",
      hasBody: true,
      signatureValid: true,
      outboundSendSucceeded: true,
    });
    const logged = JSON.stringify(info.mock.calls);
    for (const secret of [fields.Body, fields.From, fields.To, fields.MessageSid, accountSid, authToken]) {
      expect(logged).not.toContain(secret);
    }
  });
});
