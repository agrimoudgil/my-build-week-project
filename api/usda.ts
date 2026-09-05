import type { ParsedMealItem, UsdaMatch } from "../src/aiMealTypes.js";
import { matchCatalogItem, normalizeFoodName } from "../src/foodCatalog.js";

type Fetcher = typeof fetch;
const matchCache = new Map<string, UsdaMatch>();

type UsdaFood = {
  description?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: { nutrientName?: string; unitName?: string; value?: number }[];
};

function matchFromFood(item: ParsedMealItem, food: UsdaFood): UsdaMatch | null {
  const energy = food.foodNutrients?.find((nutrient) => nutrient.nutrientName === "Energy" && nutrient.unitName?.toUpperCase() === "KCAL")?.value;
  if (!Number.isFinite(energy) || energy! <= 0 || energy! > 900) return null;
  const servingGrams = food.servingSizeUnit?.toLowerCase() === "g" && Number.isFinite(food.servingSize) ? food.servingSize! : 100;
  const caloriesPerUnit = item.unit.toLowerCase().startsWith("gram") || item.unit.toLowerCase() === "g"
    ? energy! / 100
    : energy! * servingGrams / 100;
  return {
    canonicalName: item.canonicalName,
    displayName: item.displayName || food.description || item.canonicalName,
    caloriesPerUnit: Math.round(caloriesPerUnit * 10) / 10,
    unit: item.unit,
    assumption: item.unit.toLowerCase().startsWith("gram") || item.unit.toLowerCase() === "g"
      ? "Uses USDA energy per 100 g and the stated gram quantity."
      : `Uses a USDA reference serving of ${servingGrams} g.`,
  };
}

export async function resolveUsdaMatches(items: ParsedMealItem[], apiKey: string | undefined, fetcher: Fetcher = fetch): Promise<UsdaMatch[]> {
  if (!apiKey) return [];
  const unresolved = items.filter((item) => !matchCatalogItem(item.canonicalName) && !matchCatalogItem(item.displayName));
  const matches: UsdaMatch[] = [];
  for (const item of unresolved.slice(0, 4)) {
    const cacheKey = normalizeFoodName(item.canonicalName);
    const cached = matchCache.get(cacheKey);
    if (cached) { matches.push(cached); continue; }
    try {
      const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("query", item.canonicalName);
      url.searchParams.set("pageSize", "1");
      const response = await fetcher(url, { signal: AbortSignal.timeout(4_000) });
      if (!response.ok) continue;
      const payload = await response.json() as { foods?: UsdaFood[] };
      const match = payload.foods?.[0] ? matchFromFood(item, payload.foods[0]) : null;
      if (match) { matchCache.set(cacheKey, match); matches.push(match); }
    } catch { /* USDA is optional; unmatched items remain unresolved. */ }
  }
  return matches;
}

export function clearUsdaCacheForTests(): void {
  matchCache.clear();
}
