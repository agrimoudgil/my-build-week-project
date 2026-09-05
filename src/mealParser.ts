export type Confidence = "high" | "medium" | "low";

export type MealItem = {
  dishName: string;
  portion: string;
  calorieEstimate: number;
  calorieMin: number;
  calorieMax: number;
  assumption: string;
  confidence: Confidence;
};

export type Clarification = {
  question: string;
  options: { label: string; replacement: string }[];
  allowDescription?: boolean;
};

export type MealEstimate = {
  items: MealItem[];
  calorieEstimate: number;
  calorieMin: number;
  calorieMax: number;
  assumptions: string[];
  confidence: Confidence;
  clarification: Clarification | null;
  error: string | null;
};

type Unit = "katori" | "piece" | "dosa" | "cup" | "plate" | "handful" | "packet";
type Dish = { name: string; pattern: RegExp; calories: number; unit: Unit; preparationUncertain?: boolean };

const DISHES: Dish[] = [
  { name: "Masala dosa", pattern: /\bmasala dosas?\b/i, calories: 390, unit: "dosa", preparationUncertain: true },
  { name: "Chicken biryani", pattern: /\bchicken biryani\b/i, calories: 520, unit: "plate", preparationUncertain: true },
  { name: "Vegetable biryani", pattern: /\bveg(?:etable)? biryani\b/i, calories: 420, unit: "plate", preparationUncertain: true },
  { name: "Paneer butter masala", pattern: /\bpaneer butter masala\b/i, calories: 430, unit: "katori", preparationUncertain: true },
  { name: "Paneer tikka masala", pattern: /\bpaneer tikka masala\b/i, calories: 430, unit: "katori", preparationUncertain: true },
  { name: "Dal tadka", pattern: /\bdal tadka\b/i, calories: 220, unit: "katori", preparationUncertain: true },
  { name: "Dal fry", pattern: /\bdal fry\b/i, calories: 220, unit: "katori", preparationUncertain: true },
  { name: "Instant noodles", pattern: /\b(?:instant noodles|maggi|maggie)\b/i, calories: 380, unit: "packet", preparationUncertain: true },
  { name: "Hakka noodles", pattern: /\b(?:hakka noodles|chow ?mein)\b/i, calories: 420, unit: "plate", preparationUncertain: true },
  { name: "Cold coffee", pattern: /\b(?:cold coffee|iced coffee)\b/i, calories: 220, unit: "cup", preparationUncertain: true },
  { name: "Coffee", pattern: /\b(?:hot coffee|coffee)\b/i, calories: 60, unit: "cup", preparationUncertain: true },
  { name: "Noodles", pattern: /\bnoodles?\b/i, calories: 350, unit: "plate", preparationUncertain: true },
  { name: "Idli", pattern: /\bidlis?\b/i, calories: 60, unit: "piece" },
  { name: "Sambar", pattern: /\b(?:sambar|sambhar)\b/i, calories: 120, unit: "katori" },
  { name: "Dosa", pattern: /\bdosas?\b/i, calories: 170, unit: "dosa", preparationUncertain: true },
  { name: "Roti", pattern: /\b(?:rotis?|chapatis?)\b/i, calories: 110, unit: "piece" },
  { name: "Paratha", pattern: /\bparathas?\b/i, calories: 260, unit: "piece", preparationUncertain: true },
  { name: "Poha", pattern: /\bpoha\b/i, calories: 250, unit: "katori", preparationUncertain: true },
  { name: "Upma", pattern: /\bupma\b/i, calories: 240, unit: "katori", preparationUncertain: true },
  { name: "Rajma", pattern: /\brajma\b/i, calories: 180, unit: "katori" },
  { name: "Rice", pattern: /\b(?:rice|chawal)\b/i, calories: 210, unit: "katori" },
  { name: "Curd", pattern: /\b(?:curd|dahi|yogurt)\b/i, calories: 100, unit: "katori" },
  { name: "Dal", pattern: /\bdal\b/i, calories: 180, unit: "katori" },
  { name: "Paneer", pattern: /\bpaneer\b/i, calories: 300, unit: "katori", preparationUncertain: true },
  { name: "Egg", pattern: /\beggs?\b/i, calories: 78, unit: "piece" },
  { name: "Omelette", pattern: /\bomelettes?\b/i, calories: 220, unit: "piece", preparationUncertain: true },
  { name: "Banana", pattern: /\bbananas?\b/i, calories: 105, unit: "piece" },
  { name: "Apple", pattern: /\bapples?\b/i, calories: 95, unit: "piece" },
  { name: "Toast", pattern: /\b(?:toast|bread)\b/i, calories: 90, unit: "piece" },
  { name: "Tea", pattern: /\b(?:chai|tea)\b/i, calories: 90, unit: "cup", preparationUncertain: true },
];

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
};
const PORTION_PATTERN = /^(?:(half|\d+(?:\.\d+)?|a|an|one|two|three|four|five|six)(?:\s+(katoris?|bowls?|cups?|pieces?|plates?|handfuls?|packets?))?|(?:a\s+)?(small|medium|large)(?:\s+(katoris?|bowls?|cups?|pieces?|plates?|handfuls?|packets?))?|(?:a\s+)?(handful|plate))\s+/i;

function pluralUnit(quantity: number, unit: Unit): string {
  if (unit === "katori") return quantity === 1 ? "katori" : "katoris";
  if (unit === "piece") return quantity === 1 ? "piece" : "pieces";
  return quantity === 1 ? unit : `${unit}s`;
}

function normalizedUnit(raw: string | undefined, fallback: Unit): Unit {
  if (!raw) return fallback;
  const value = raw.toLowerCase();
  if (value.startsWith("bowl") || value.startsWith("katori")) return "katori";
  if (value.startsWith("cup")) return "cup";
  if (value.startsWith("piece")) return "piece";
  if (value.startsWith("plate")) return "plate";
  if (value.startsWith("handful")) return "handful";
  if (value.startsWith("packet")) return "packet";
  return fallback;
}

function parseClause(rawClause: string): MealItem | null {
  const clause = rawClause.trim();
  const match = clause.match(PORTION_PATTERN);
  const rawQuantity = match?.[1]?.toLowerCase();
  const size = match?.[3]?.toLowerCase() as "small" | "medium" | "large" | undefined;
  const standaloneUnit = match?.[5]?.toLowerCase();
  const dishText = match ? clause.slice(match[0].length) : clause;
  const dish = DISHES.find((candidate) => candidate.pattern.test(dishText));
  if (!dish) return null;

  const numericQuantity = rawQuantity
    ? rawQuantity === "half" ? 0.5 : /^\d/.test(rawQuantity) ? Number(rawQuantity) : WORD_NUMBERS[rawQuantity]
    : 1;
  const unit = normalizedUnit(match?.[2] ?? match?.[4] ?? standaloneUnit, dish.unit);
  const sizeMultiplier = size === "small" ? 0.75 : size === "large" ? 1.5 : 1;
  const unitMultiplier = unit === "handful" && dish.unit !== "handful" ? 0.5
    : unit === "plate" && dish.unit === "katori" ? 2 : 1;
  const quantity = numericQuantity * sizeMultiplier * unitMultiplier;
  const portion = size ? `${size} ${pluralUnit(1, unit)}`
    : standaloneUnit ? standaloneUnit
      : rawQuantity === "half" ? `half ${pluralUnit(1, unit)}`
        : dish.name === "Roti" && !match?.[2] ? `${numericQuantity} ${numericQuantity === 1 ? "roti" : "rotis"}`
          : `${numericQuantity} ${pluralUnit(numericQuantity, unit)}`;
  const explicit = Boolean(match);
  const confidence: Confidence = !explicit ? "low" : size || dish.preparationUncertain ? "medium" : "high";
  const uncertainty = !explicit ? 0.3 : size || dish.preparationUncertain ? 0.2 : 0.12;
  const calorieEstimate = Math.round(dish.calories * quantity);
  const preparation = dish.name === "Tea"
    ? " with 100 ml milk and 2 teaspoons sugar per cup"
    : dish.name === "Cold coffee" ? " with 150 ml milk and 2 teaspoons sugar, without ice cream"
      : dish.name === "Coffee" ? " with 100 ml milk and 1 teaspoon sugar per cup"
    : dish.preparationUncertain ? " and regular preparation" : "";
  return {
    dishName: dish.name,
    portion,
    calorieEstimate,
    calorieMin: Math.round(calorieEstimate * (1 - uncertainty)),
    calorieMax: Math.round(calorieEstimate * (1 + uncertainty)),
    assumption: `Assumes ${portion} of ${dish.name.toLocaleLowerCase("en-IN")}${preparation}.`,
    confidence,
  };
}

const CONFIDENCE_ORDER: Confidence[] = ["low", "medium", "high"];

export function interpretMeal(input: string): MealEstimate {
  const original = input.trim();
  if (/\b(?:some|unknown)\s+(?:rice|chawal)\b/i.test(original)) {
    return {
      items: [], calorieEstimate: 0, calorieMin: 0, calorieMax: 0, assumptions: [], confidence: "low", error: null,
      clarification: {
        question: "How much rice was it?",
        options: [
          { label: "Half katori", replacement: "half katori rice" },
          { label: "One katori", replacement: "one katori rice" },
          { label: "More", replacement: "two katoris rice" },
        ],
      },
    };
  }
  if (/\b(?:mixed\s+)?thali\b/i.test(original) && !DISHES.some((dish) => dish.pattern.test(original.replace(/\bthali\b/gi, "")))) {
    return {
      items: [], calorieEstimate: 0, calorieMin: 0, calorieMax: 0, assumptions: [], confidence: "low", error: null,
      clarification: {
        question: "What were the main items in your thali?",
        options: [],
        allowDescription: true,
      },
    };
  }

  const normalized = original.replace(/\bone\s+and\s+a\s+half\b/gi, "1.5");
  const clauses = normalized.split(/\s*,\s*|\s+(?:and|with)\s+/i).filter(Boolean);
  const items = clauses.flatMap((clause) => {
    const item = parseClause(clause);
    return item ? [item] : [];
  });
  if (items.length === 0) {
    return {
      items: [], calorieEstimate: 0, calorieMin: 0, calorieMax: 0, assumptions: [], confidence: "low", error: "We couldn’t recognise a food in that entry. Describe the main items and portions.",
      clarification: null,
    };
  }

  const calorieEstimate = items.reduce((sum, item) => sum + item.calorieEstimate, 0);
  const clarification = /\b(?:cold|iced) coffee\b/i.test(original) && !/\b(?:small|medium|large|ice cream|without ice cream|no ice cream)\b/i.test(original)
    ? {
        question: "What size was the cold coffee, and did it include ice cream?",
        options: [
          { label: "Small, no ice cream", replacement: "small cup cold coffee without ice cream" },
          { label: "Medium, no ice cream", replacement: "medium cup cold coffee without ice cream" },
          { label: "Large or with ice cream", replacement: "large cup cold coffee with ice cream" },
        ],
      }
    : /\bnoodles?\b/i.test(original) && !/\b(?:instant|maggi|maggie|hakka|chow ?mein)\b/i.test(original)
      ? {
          question: "What type of noodles was it?",
          options: [
            { label: "Instant noodles", replacement: original.replace(/noodles?/i, "instant noodles") },
            { label: "Hakka noodles", replacement: original.replace(/noodles?/i, "Hakka noodles") },
            { label: "Other", replacement: original },
          ],
          allowDescription: true,
        }
      : null;
  return {
    items,
    calorieEstimate,
    calorieMin: items.reduce((sum, item) => sum + item.calorieMin, 0),
    calorieMax: items.reduce((sum, item) => sum + item.calorieMax, 0),
    assumptions: items.map((item) => item.assumption),
    confidence: items.reduce<Confidence>((lowest, item) =>
      CONFIDENCE_ORDER.indexOf(item.confidence) < CONFIDENCE_ORDER.indexOf(lowest) ? item.confidence : lowest, "high"),
    clarification,
    error: null,
  };
}
