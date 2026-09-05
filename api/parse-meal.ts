import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { AiMealResponse } from "../src/aiMealTypes.js";
import { resolveUsdaMatches } from "./usda.js";

const MAX_INPUT_LENGTH = 500;
const ParsedMealSchema = z.object({
  items: z.array(z.object({
    canonicalName: z.string().min(1).max(80),
    displayName: z.string().min(1).max(80),
    quantity: z.number().positive().max(50),
    unit: z.string().min(1).max(30),
    preparation: z.string().max(160),
    confidence: z.enum(["high", "medium", "low"]),
  })).max(12),
  mealType: z.enum(["breakfast", "lunch", "snack", "dinner"]),
  overallConfidence: z.enum(["high", "medium", "low"]),
  needsClarification: z.boolean(),
  clarificationQuestion: z.string().max(180).nullable(),
});

type ResponsesClient = Pick<OpenAI, "responses">;
type ParseEnvironment = { OPENAI_API_KEY?: string; OPENAI_MODEL?: string; USDA_API_KEY?: string };

export class SafeHttpError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

export async function parseMealOnServer(
  text: unknown,
  environment: ParseEnvironment = process.env,
  client?: ResponsesClient,
  fetcher: typeof fetch = fetch,
): Promise<AiMealResponse> {
  if (typeof text !== "string" || !text.trim()) throw new SafeHttpError(400, "invalid_input");
  if (text.length > MAX_INPUT_LENGTH) throw new SafeHttpError(413, "input_too_long");
  if (!environment.OPENAI_API_KEY && !client) throw new SafeHttpError(503, "ai_unconfigured");
  const openai = client ?? new OpenAI({ apiKey: environment.OPENAI_API_KEY, timeout: 8_000, maxRetries: 0 });
  let parsed;
  try {
    const response = await openai.responses.parse({
      model: environment.OPENAI_MODEL || "gpt-5.6-luna",
      store: false,
      max_output_tokens: 1_200,
      instructions: "Interpret the meal description into distinct foods. Preserve multiword dishes. Understand Indian and Hinglish food names and spelling variants. Do not provide calories. Do not map unknown foods to unrelated foods. Ask exactly one focused clarification when food, portion, size, or preparation is ambiguous. Use a best-fit meal type.",
      input: text.trim(),
      text: { format: zodTextFormat(ParsedMealSchema, "meal_interpretation") },
    });
    const validated = ParsedMealSchema.safeParse(response.output_parsed);
    if (!validated.success) throw new SafeHttpError(502, "invalid_ai_response");
    parsed = validated.data;
  } catch {
    throw new SafeHttpError(502, "ai_unavailable");
  }
  if (!parsed) throw new SafeHttpError(502, "invalid_ai_response");
  const usdaMatches = await resolveUsdaMatches(parsed.items, environment.USDA_API_KEY, fetcher);
  return { parsed, usdaMatches };
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "method_not_allowed" });
    return;
  }
  try {
    const result = await parseMealOnServer(request.body?.text);
    response.status(200).json(result);
  } catch (error) {
    const safe = error instanceof SafeHttpError ? error : new SafeHttpError(500, "server_error");
    const fallbackAvailable = ["ai_unconfigured", "ai_unavailable", "invalid_ai_response"].includes(safe.code);
    response.status(fallbackAvailable ? 200 : safe.status).json({ error: safe.code, fallbackAvailable });
  }
}
