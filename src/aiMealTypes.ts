export type MealType = "breakfast" | "lunch" | "snack" | "dinner";
export type ParsedConfidence = "high" | "medium" | "low";

export type ParsedMealItem = {
  canonicalName: string;
  displayName: string;
  quantity: number;
  unit: string;
  preparation: string;
  confidence: ParsedConfidence;
};

export type ParsedMeal = {
  items: ParsedMealItem[];
  mealType: MealType;
  overallConfidence: ParsedConfidence;
  needsClarification: boolean;
  clarificationQuestion: string | null;
};

export type UsdaMatch = {
  canonicalName: string;
  displayName: string;
  caloriesPerUnit: number;
  unit: string;
  assumption: string;
};

export type AiMealResponse = {
  parsed: ParsedMeal;
  usdaMatches: UsdaMatch[];
};

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "snack", "dinner"];
const CONFIDENCES: ParsedConfidence[] = ["high", "medium", "low"];

export function isParsedMeal(value: unknown): value is ParsedMeal {
  const meal = value as Partial<ParsedMeal> | null;
  if (!meal || !Array.isArray(meal.items) || !MEAL_TYPES.includes(meal.mealType as MealType) ||
    !CONFIDENCES.includes(meal.overallConfidence as ParsedConfidence) || typeof meal.needsClarification !== "boolean" ||
    !(meal.clarificationQuestion === null || typeof meal.clarificationQuestion === "string")) return false;
  return meal.items.length <= 12 && meal.items.every((raw) => {
    const item = raw as Partial<ParsedMealItem> | null;
    return Boolean(item && typeof item.canonicalName === "string" && item.canonicalName.trim() && item.canonicalName.length <= 80 &&
      typeof item.displayName === "string" && item.displayName.trim() && item.displayName.length <= 80 &&
      typeof item.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0 && item.quantity <= 50 &&
      typeof item.unit === "string" && item.unit.trim() && item.unit.length <= 30 &&
      typeof item.preparation === "string" && item.preparation.length <= 160 &&
      CONFIDENCES.includes(item.confidence as ParsedConfidence));
  });
}

export function isAiMealResponse(value: unknown): value is AiMealResponse {
  const response = value as Partial<AiMealResponse> | null;
  return Boolean(response && isParsedMeal(response.parsed) && Array.isArray(response.usdaMatches) && response.usdaMatches.every((raw) => {
    const match = raw as Partial<UsdaMatch> | null;
    return match && typeof match.canonicalName === "string" && typeof match.displayName === "string" &&
      Number.isFinite(match.caloriesPerUnit) && match.caloriesPerUnit! > 0 && typeof match.unit === "string" &&
      typeof match.assumption === "string";
  }));
}

export function suggestMealType(date = new Date()): MealType {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hourCycle: "h23" }).format(date));
  if (hour >= 5 && hour <= 10) return "breakfast";
  if (hour >= 11 && hour <= 15) return "lunch";
  if (hour >= 16 && hour <= 18) return "snack";
  return "dinner";
}

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snack: "Snacks",
  dinner: "Dinner",
};
