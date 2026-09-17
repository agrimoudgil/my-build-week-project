import type { VercelRequest, VercelResponse } from "@vercel/node";
import twilio from "twilio";

type FormFields = Record<string, string>;
type WebhookInput = {
  method: string;
  signature: string;
  webhookUrl?: string;
  fields: FormFields;
  authToken?: string;
};
type OutboundMessage = {
  to: string;
  from: string;
  body: string;
};
type WebhookResult = {
  status: number;
  xml: string;
  signatureValid: boolean;
  outbound?: OutboundMessage;
};

const emptyTwiml = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

export function handleWhatsAppWebhook(input: WebhookInput): WebhookResult {
  if (input.method !== "POST") {
    return { status: 405, xml: emptyTwiml, signatureValid: false };
  }
  if (!input.authToken || !input.webhookUrl) {
    return { status: 500, xml: emptyTwiml, signatureValid: false };
  }

  const signatureValid = Boolean(
    input.signature && twilio.validateRequest(input.authToken, input.signature, input.webhookUrl, input.fields),
  );
  if (!signatureValid) {
    return { status: 403, xml: emptyTwiml, signatureValid: false };
  }

  const body = (input.fields.Body ?? "").trim();
  const from = input.fields.From ?? "";
  const to = input.fields.To ?? "";
  if (!body || !from.startsWith("whatsapp:") || !to.startsWith("whatsapp:")) {
    return { status: 400, xml: emptyTwiml, signatureValid: true };
  }

  return {
    status: 200,
    xml: emptyTwiml,
    signatureValid: true,
    outbound: { to: from, from: to, body: `Received: ${body}` },
  };
}

function formFields(body: unknown): FormFields {
  if (Buffer.isBuffer(body)) return Object.fromEntries(new URLSearchParams(body.toString("utf8")));
  if (typeof body === "string") return Object.fromEntries(new URLSearchParams(body));
  if (!body || typeof body !== "object") return {};
  return Object.fromEntries(
    Object.entries(body).map(([key, value]) => [key, Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "")]),
  );
}

async function requestFormFields(request: VercelRequest): Promise<FormFields> {
  if (request.body !== undefined && request.body !== null) return formFields(request.body);

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return formFields(Buffer.concat(chunks));
}

function contentType(request: VercelRequest): string {
  const value = request.headers["content-type"];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function logDiagnostics(details: {
  method: string;
  contentType: string;
  hasBody: boolean;
  signatureValid: boolean;
  outboundSendSucceeded: boolean;
}): void {
  console.info(details);
}

function safeTwilioErrorValue(value: unknown): string | number | undefined {
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method === "GET") {
    logDiagnostics({
      method: "GET",
      contentType: contentType(request),
      hasBody: false,
      signatureValid: false,
      outboundSendSucceeded: false,
    });
    response.setHeader("Content-Type", "application/json");
    response.status(200).json({ ok: true });
    return;
  }

  const fields = await requestFormFields(request);
  let result = handleWhatsAppWebhook({
    method: request.method ?? "",
    signature: String(request.headers["x-twilio-signature"] ?? ""),
    webhookUrl: process.env.TWILIO_WEBHOOK_URL,
    fields,
    authToken: process.env.TWILIO_AUTH_TOKEN,
  });
  let outboundSendSucceeded = false;
  if (result.outbound) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      result = { ...result, status: 500, outbound: undefined };
    } else {
      try {
        await twilio(accountSid, authToken).messages.create(result.outbound);
        outboundSendSucceeded = true;
      } catch (error) {
        const twilioError = error as { code?: unknown; status?: unknown };
        console.error({
          twilioErrorCode: safeTwilioErrorValue(twilioError.code),
          twilioErrorStatus: safeTwilioErrorValue(twilioError.status),
        });
        result = { ...result, status: 500, outbound: undefined };
      }
    }
  }
  logDiagnostics({
    method: request.method ?? "",
    contentType: contentType(request),
    hasBody: Boolean((fields.Body ?? "").trim()),
    signatureValid: result.signatureValid,
    outboundSendSucceeded,
  });
  response.setHeader("Content-Type", "text/xml; charset=utf-8");
  if (result.status === 405) response.setHeader("Allow", "GET, POST");
  response.status(result.status).send(result.xml);
}
