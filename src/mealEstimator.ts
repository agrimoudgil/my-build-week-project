import type { ParsedMeal, ParsedMealItem, UsdaMatch } from "./aiMealTypes.js";
import { matchCatalogItem, normalizeFoodName, type CatalogUnit, type FoodCatalogEntry } from "./foodCatalog.js";
import type { Clarification, Confidence, MealEstimate, MealItem } from "./mealParser.js";

function normalizeUnit(value: string): CatalogUnit | "serving" | "gram" | "ml" {
  const unit = value.toLocaleLowerCase("en-IN");
  if (unit.startsWith("bowl") || unit.startsWith("katori")) return "katori";
  if (unit.startsWith("piece") || unit === "idli" || unit === "roti") return "piece";
  if (unit.startsWith("cup")) return "cup";
  if (unit.startsWith("plate")) return "plate";
  if (unit.startsWith("handful")) return "handful";
  if (unit.startsWith("packet") || unit.startsWith("pack")) return "packet";
  if (unit === "g" || unit.startsWith("gram")) return "gram";
  if (unit === "ml" || unit.startsWith("millil")) return "ml";
  if (unit.startsWith("dosa")) return "dosa";
  return "serving";
}

function formatQuantity(quantity: number): string {
  if (quantity === .5) return "half";
  return Number.isInteger(quantity) ? String(quantity) : String(Math.round(quantity * 10) / 10);
}

function pluralUnit(quantity: number, unit: string): string {
  if (quantity === 1 || quantity === .5) return unit;
  if (unit === "katori") return "katoris";
  if (unit === "piece") return "pieces";
  return `${unit}s`;
}

function unitMultiplier(item: ParsedMealItem, food: FoodCatalogEntry): number | null {
  const unit = normalizeUnit(item.unit);
  if (unit === food.unit || (unit === "katori" && food.unit === "katori") || unit === "serving") return item.quantity;
  if (unit === "plate" && food.unit === "katori") return item.quantity * 2;
  if (unit === "handful" && food.unit === "katori") return item.quantity * .5;
  if (unit === "gram") return item.quantity / 100;
  if (unit === "ml" && food.unit === "cup") return item.quantity / 240;
  if (unit === "piece" && food.unit === "dosa") return item.quantity;
  return null;
}

function uncertainty(confidence: Confidence, preparationUncertain: boolean): number {
  if (confidence === "low") return .3;
  if (confidence === "medium" || preparationUncertain) return .2;
  return .12;
}

function itemFromCatalog(parsed: ParsedMealItem, food: FoodCatalogEntry): MealItem | null {
  const multiplier = unitMultiplier(parsed, food);
  if (multiplier === null) return null;
  const unit = normalizeUnit(parsed.unit);
  const portionUnit = unit === "serving" ? food.unit : unit;
  const portion = `${formatQuantity(parsed.quantity)} ${pluralUnit(parsed.quantity, portionUnit)}`;
  const calorieEstimate = Math.round(food.calories * multiplier);
  const spread = uncertainty(parsed.confidence, Boolean(food.preparationUncertain));
  const preparation = parsed.preparation.trim();
  const assumption = food.assumption ?? `Assumes ${portion} of ${food.displayName.toLocaleLowerCase("en-IN")}${preparation ? `, ${preparation}` : food.preparationUncertain ? ", regular preparation" : ""}.`;
  return {
    dishName: food.displayName,
    portion,
    calorieEstimate,
    calorieMin: Math.round(calorieEstimate * (1 - spread)),
    calorieMax: Math.round(calorieEstimate * (1 + spread)),
    assumption,
    confidence: parsed.confidence,
  };
}

function itemFromUsda(parsed: ParsedMealItem, matches: UsdaMatch[]): MealItem | null {
  const match = matches.find((candidate) => normalizeFoodName(candidate.canonicalName) === normalizeFoodName(parsed.canonicalName));
  if (!match) return null;
  const calorieEstimate = Math.round(match.caloriesPerUnit * parsed.quantity);
  const spread = uncertainty(parsed.confidence, true);
  return {
    dishName: parsed.displayName || match.displayName,
    portion: `${formatQuantity(parsed.quantity)} ${pluralUnit(parsed.quantity, parsed.unit)}`,
    calorieEstimate,
    calorieMin: Math.round(calorieEstimate * (1 - spread)),
    calorieMax: Math.round(calorieEstimate * (1 + spread)),
    assumption: match.assumption,
    confidence: parsed.confidence,
  };
}

function clarificationFor(parsed: ParsedMeal, unresolved: ParsedMealItem[]): Clarification | null {
  if (parsed.needsClarification && parsed.clarificationQuestion) {
    return { question: parsed.clarificationQuestion, options: [], allowDescription: true };
  }
  if (unresolved.length) {
    const name = unresolved[0].displayName || unresolved[0].canonicalName;
    return { question: `Could you describe the portion and preparation for ${name}?`, options: [], allowDescription: true };
  }
  const low = parsed.items.find((item) => item.confidence === "low");
  return low ? { question: `Could you clarify the portion or preparation for ${low.displayName}?`, options: [], allowDescription: true } : null;
}

export function estimateParsedMeal(parsed: ParsedMeal, usdaMatches: UsdaMatch[] = []): MealEstimate {
  const unresolved: ParsedMealItem[] = [];
  const items = parsed.items.flatMap((item) => {
    const food = matchCatalogItem(item.canonicalName) ?? matchCatalogItem(item.displayName);
    const estimate = food ? itemFromCatalog(item, food) : itemFromUsda(item, usdaMatches);
    if (!estimate) unresolved.push(item);
    return estimate ? [estimate] : [];
  });
  const clarification = clarificationFor(parsed, unresolved);
  if (!items.length) {
    return {
      items: [], calorieEstimate: 0, calorieMin: 0, calorieMax: 0, assumptions: [], confidence: "low",
      clarification,
      error: clarification ? null : "We couldn’t match that food to a trusted calorie source. Please describe the main items and portions.",
    };
  }
  const confidence: Confidence = parsed.overallConfidence;
  return {
    items,
    calorieEstimate: items.reduce((sum, item) => sum + item.calorieEstimate, 0),
    calorieMin: items.reduce((sum, item) => sum + item.calorieMin, 0),
    calorieMax: items.reduce((sum, item) => sum + item.calorieMax, 0),
    assumptions: items.map((item) => item.assumption),
    confidence,
    clarification,
    error: null,
  };
}
