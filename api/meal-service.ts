import OpenAI from "openai";
import { estimateParsedMeal } from "../src/mealEstimator.js";
import { interpretMeal, type MealEstimate } from "../src/mealParser.js";
import { parseMealOnServer } from "./parse-meal.js";

export type ServerMealAnalysis = { estimate: MealEstimate; sourceText: string };
type Environment = { OPENAI_API_KEY?: string; OPENAI_MODEL?: string; USDA_API_KEY?: string };

export class MealAnalysisError extends Error {}

export async function analyzeServerMeal(
  text: string,
  options: { environment?: Environment; parse?: typeof parseMealOnServer } = {},
): Promise<ServerMealAnalysis> {
  const sourceText = text.trim();
  if (!sourceText) throw new MealAnalysisError("empty_input");
  const environment = options.environment ?? process.env;
  let estimate: MealEstimate;
  if (environment.OPENAI_API_KEY) {
    try {
      const response = await (options.parse ?? parseMealOnServer)(sourceText, environment);
      estimate = estimateParsedMeal(response.parsed, response.usdaMatches);
    } catch {
      estimate = interpretMeal(sourceText);
    }
  } else {
    estimate = interpretMeal(sourceText);
  }
  if (estimate.error || !estimate.items.length) throw new MealAnalysisError("analysis_failed");
  return { estimate, sourceText };
}

export async function describeMealPhoto(
  media: { bytes: Uint8Array; contentType: string },
  options: { environment?: Environment; client?: Pick<OpenAI, "responses"> } = {},
): Promise<string> {
  const environment = options.environment ?? process.env;
  if (!environment.OPENAI_API_KEY && !options.client) throw new MealAnalysisError("image_analysis_unavailable");
  const client = options.client ?? new OpenAI({ apiKey: environment.OPENAI_API_KEY, timeout: 8_000, maxRetries: 0 });
  try {
    const base64 = Buffer.from(media.bytes).toString("base64");
    const response = await client.responses.create({
      model: environment.OPENAI_MODEL || "gpt-5.6-luna",
      store: false,
      max_output_tokens: 200,
      instructions: "Describe only the visible meal items and portions in one concise sentence. Do not estimate calories or macros. If the food is not readable, reply UNREADABLE.",
      input: [{ role: "user", content: [
        { type: "input_text", text: "Identify this meal for the existing meal parser." },
        { type: "input_image", image_url: `data:${media.contentType};base64,${base64}`, detail: "low" },
      ] }],
    });
    const description = response.output_text.trim();
    if (!description || description === "UNREADABLE") throw new MealAnalysisError("image_unreadable");
    return description;
  } catch (error) {
    if (error instanceof MealAnalysisError) throw error;
    throw new MealAnalysisError("image_unreadable");
  }
}
