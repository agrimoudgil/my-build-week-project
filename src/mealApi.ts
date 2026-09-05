import type { MealType } from "./aiMealTypes";
import { isAiMealResponse, suggestMealType } from "./aiMealTypes";
import { estimateParsedMeal } from "./mealEstimator";
import { interpretMeal, type MealEstimate } from "./mealParser";

export type MealAnalysis = {
  estimate: MealEstimate;
  mealType: MealType;
  source: "ai" | "local";
};

type AnalyzeOptions = {
  fetcher?: typeof fetch;
  endpoint?: string;
  timeoutMs?: number;
  aiEnabled?: boolean;
  now?: Date;
};

export function analyzeMealLocally(text: string, now = new Date()): MealAnalysis {
  return { estimate: interpretMeal(text), mealType: suggestMealType(now), source: "local" };
}

export async function analyzeMealText(text: string, options: AnalyzeOptions = {}): Promise<MealAnalysis> {
  const trimmed = text.trim();
  if (!options.aiEnabled) return analyzeMealLocally(trimmed, options.now);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 9_000);
  try {
    const response = await (options.fetcher ?? fetch)(options.endpoint ?? "/api/parse-meal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
      signal: controller.signal,
    });
    if (!response.ok) return analyzeMealLocally(trimmed, options.now);
    const payload: unknown = await response.json();
    if (!isAiMealResponse(payload)) return analyzeMealLocally(trimmed, options.now);
    return {
      estimate: estimateParsedMeal(payload.parsed, payload.usdaMatches),
      mealType: payload.parsed.mealType,
      source: "ai",
    };
  } catch {
    return analyzeMealLocally(trimmed, options.now);
  } finally {
    window.clearTimeout(timer);
  }
}
