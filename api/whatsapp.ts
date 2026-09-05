import type { VercelRequest, VercelResponse } from "@vercel/node";
import twilio from "twilio";
import { analyzeServerMeal, describeMealPhoto, MealAnalysisError, type ServerMealAnalysis } from "./meal-service.js";
import { saveWhatsAppMeal } from "./whatsapp-store.js";

type FormFields = Record<string, string>;
type Dependencies = {
  validate: (token: string, signature: string, url: string, params: FormFields) => boolean;
  analyzeText: (text: string) => Promise<ServerMealAnalysis>;
  analyzePhoto: (fields: FormFields) => Promise<ServerMealAnalysis>;
  save: (from: string, analysis: ServerMealAnalysis) => Promise<unknown>;
};

const xmlEscape = (value: string) => value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character]!);
const twiml = (message?: string) => `<?xml version="1.0" encoding="UTF-8"?><Response>${message ? `<Message>${xmlEscape(message)}</Message>` : ""}</Response>`;

function resultMessage(analysis: ServerMealAnalysis): string {
  const names = analysis.estimate.items.map((item) => `${item.dishName} (${item.portion})`).join(", ");
  return `${names}\nApproximately ${analysis.estimate.calorieEstimate} kcal\nEstimated range: ${analysis.estimate.calorieMin}–${analysis.estimate.calorieMax} kcal\nStatus: Awaiting review`;
}

async function downloadPhoto(fields: FormFields, fetcher: typeof fetch = fetch): Promise<{ bytes: Uint8Array; contentType: string }> {
  const mediaUrl = fields.MediaUrl0;
  const contentType = fields.MediaContentType0;
  if (!mediaUrl || !contentType?.startsWith("image/")) throw new MealAnalysisError("image_unreadable");
  const accountSid = fields.AccountSid;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const headers = accountSid && authToken ? { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}` } : undefined;
  const response = await fetcher(mediaUrl, { headers, signal: AbortSignal.timeout(6_000) });
  if (!response.ok) throw new MealAnalysisError("image_unreadable");
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > 8_000_000) throw new MealAnalysisError("image_unreadable");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 8_000_000) throw new MealAnalysisError("image_unreadable");
  return { bytes, contentType };
}

const defaultDependencies: Dependencies = {
  validate: twilio.validateRequest,
  analyzeText: analyzeServerMeal,
  analyzePhoto: async (fields) => {
    const description = await describeMealPhoto(await downloadPhoto(fields));
    return analyzeServerMeal(fields.Body?.trim() ? `${fields.Body.trim()}. ${description}` : description);
  },
  save: saveWhatsAppMeal,
};

export async function handleWhatsAppWebhook(input: {
  method: string;
  signature: string;
  url: string;
  fields: FormFields;
  authToken?: string;
}, dependencies: Dependencies = defaultDependencies): Promise<{ status: number; xml: string }> {
  if (input.method !== "POST") return { status: 405, xml: twiml() };
  if (!input.authToken || !input.signature || !dependencies.validate(input.authToken, input.signature, input.url, input.fields)) {
    return { status: 403, xml: twiml() };
  }
  const mediaCount = Number.parseInt(input.fields.NumMedia || "0", 10) || 0;
  if (!input.fields.Body?.trim() && mediaCount === 0) {
    return { status: 200, xml: twiml("Send a meal description or one clear meal photo and try again.") };
  }
  if (mediaCount > 1) return { status: 200, xml: twiml("Send one meal photo at a time and try again.") };
  let analysis: ServerMealAnalysis;
  try {
    analysis = mediaCount === 1 ? await dependencies.analyzePhoto(input.fields) : await dependencies.analyzeText(input.fields.Body.trim());
  } catch {
    const message = mediaCount === 1
      ? "I couldn’t read that meal photo. Send one clear photo or type the meal and portions."
      : "I couldn’t analyse that meal. Add the main foods and portions, then try again.";
    return { status: 200, xml: twiml(message) };
  }
  try {
    await dependencies.save(input.fields.From, analysis);
  } catch {
    return { status: 200, xml: twiml("I analysed the meal but couldn’t save it. Please try again.") };
  }
  return { status: 200, xml: twiml(resultMessage(analysis)) };
}

function formFields(body: unknown): FormFields {
  if (typeof body === "string") return Object.fromEntries(new URLSearchParams(body));
  if (!body || typeof body !== "object") return {};
  return Object.fromEntries(Object.entries(body).map(([key, value]) => [key, Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "")]));
}

function requestUrl(request: VercelRequest): string {
  const protocol = String(request.headers["x-forwarded-proto"] ?? "https").split(",")[0].trim();
  const host = String(request.headers["x-forwarded-host"] ?? request.headers.host ?? "").split(",")[0].trim();
  return `${protocol}://${host}${request.url ?? "/api/whatsapp"}`;
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  const result = await handleWhatsAppWebhook({
    method: request.method ?? "",
    signature: String(request.headers["x-twilio-signature"] ?? ""),
    url: requestUrl(request),
    fields: formFields(request.body),
    authToken: process.env.TWILIO_AUTH_TOKEN,
  });
  response.setHeader("Content-Type", "text/xml; charset=utf-8");
  if (result.status === 405) response.setHeader("Allow", "POST");
  response.status(result.status).send(result.xml);
}
