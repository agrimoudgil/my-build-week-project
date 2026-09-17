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
type WebhookResult = {
  status: number;
  xml: string;
  signatureValid: boolean;
  responseHasMessage: boolean;
};

const xmlEscape = (value: string) => value.replace(/[<>&'\"]/g, (character) => ({
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  "'": "&apos;",
  '\"': "&quot;",
})[character]!);

const twiml = (message?: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><Response>${message === undefined ? "" : `<Message>${xmlEscape(message)}</Message>`}</Response>`;

export function handleWhatsAppWebhook(input: WebhookInput): WebhookResult {
  if (input.method !== "POST") {
    return { status: 405, xml: twiml(), signatureValid: false, responseHasMessage: false };
  }
  if (!input.authToken || !input.webhookUrl) {
    return { status: 500, xml: twiml(), signatureValid: false, responseHasMessage: false };
  }

  const signatureValid = Boolean(
    input.signature && twilio.validateRequest(input.authToken, input.signature, input.webhookUrl, input.fields),
  );
  if (!signatureValid) {
    return { status: 403, xml: twiml(), signatureValid: false, responseHasMessage: false };
  }

  const body = (input.fields.Body ?? "").trim();
  const message = body ? `Received: ${body}` : "No message text was received. Please send a text message.";

  return { status: 200, xml: twiml(message), signatureValid: true, responseHasMessage: true };
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
  responseHasMessage: boolean;
}): void {
  console.info(details);
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method === "GET") {
    logDiagnostics({
      method: "GET",
      contentType: contentType(request),
      hasBody: false,
      signatureValid: false,
      responseHasMessage: false,
    });
    response.setHeader("Content-Type", "application/json");
    response.status(200).json({ ok: true });
    return;
  }

  const fields = await requestFormFields(request);
  const result = handleWhatsAppWebhook({
    method: request.method ?? "",
    signature: String(request.headers["x-twilio-signature"] ?? ""),
    webhookUrl: process.env.TWILIO_WEBHOOK_URL,
    fields,
    authToken: process.env.TWILIO_AUTH_TOKEN,
  });
  logDiagnostics({
    method: request.method ?? "",
    contentType: contentType(request),
    hasBody: Boolean((fields.Body ?? "").trim()),
    signatureValid: result.signatureValid,
    responseHasMessage: result.responseHasMessage,
  });
  response.setHeader("Content-Type", "text/xml; charset=utf-8");
  if (result.status === 405) response.setHeader("Allow", "GET, POST");
  response.status(result.status).send(result.xml);
}
