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

const xmlEscape = (value: string) => value.replace(/[<>&'\"]/g, (character) => ({
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  "'": "&apos;",
  '\"': "&quot;",
})[character]!);

const twiml = (message?: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><Response>${message === undefined ? "" : `<Message>${xmlEscape(message)}</Message>`}</Response>`;

export function handleWhatsAppWebhook(input: WebhookInput): { status: number; xml: string } {
  if (input.method !== "POST") return { status: 405, xml: twiml() };
  if (!input.authToken || !input.webhookUrl) return { status: 500, xml: twiml() };
  if (!input.signature || !twilio.validateRequest(input.authToken, input.signature, input.webhookUrl, input.fields)) {
    return { status: 403, xml: twiml() };
  }

  const { Body, From, To, MessageSid } = input.fields;
  void From;
  void To;
  void MessageSid;
  if (!Body) return { status: 400, xml: twiml() };

  return { status: 200, xml: twiml(`Received: ${Body}`) };
}

function formFields(body: unknown): FormFields {
  if (typeof body === "string") return Object.fromEntries(new URLSearchParams(body));
  if (!body || typeof body !== "object") return {};
  return Object.fromEntries(
    Object.entries(body).map(([key, value]) => [key, Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "")]),
  );
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method === "GET") {
    response.setHeader("Content-Type", "application/json");
    response.status(200).json({ ok: true });
    return;
  }

  const result = handleWhatsAppWebhook({
    method: request.method ?? "",
    signature: String(request.headers["x-twilio-signature"] ?? ""),
    webhookUrl: process.env.TWILIO_WEBHOOK_URL,
    fields: formFields(request.body),
    authToken: process.env.TWILIO_AUTH_TOKEN,
  });
  response.setHeader("Content-Type", "text/xml; charset=utf-8");
  if (result.status === 405) response.setHeader("Allow", "GET, POST");
  response.status(result.status).send(result.xml);
}
