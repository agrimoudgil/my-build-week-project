export type CatalogUnit = "katori" | "piece" | "dosa" | "cup" | "plate" | "handful" | "packet";

export type FoodCatalogEntry = {
  canonicalName: string;
  displayName: string;
  aliases: string[];
  calories: number;
  unit: CatalogUnit;
  preparationUncertain?: boolean;
  assumption?: string;
};

export const FOOD_CATALOG: FoodCatalogEntry[] = [
  { canonicalName: "masala dosa", displayName: "Masala dosa", aliases: ["masala dosa", "masala dosas"], calories: 390, unit: "dosa", preparationUncertain: true },
  { canonicalName: "chicken biryani", displayName: "Chicken biryani", aliases: ["chicken biryani"], calories: 520, unit: "plate", preparationUncertain: true },
  { canonicalName: "vegetable biryani", displayName: "Vegetable biryani", aliases: ["vegetable biryani", "veg biryani"], calories: 420, unit: "plate", preparationUncertain: true },
  { canonicalName: "paneer butter masala", displayName: "Paneer butter masala", aliases: ["paneer butter masala"], calories: 430, unit: "katori", preparationUncertain: true },
  { canonicalName: "paneer tikka masala", displayName: "Paneer tikka masala", aliases: ["paneer tikka masala"], calories: 430, unit: "katori", preparationUncertain: true },
  { canonicalName: "dal tadka", displayName: "Dal tadka", aliases: ["dal tadka"], calories: 220, unit: "katori", preparationUncertain: true },
  { canonicalName: "dal fry", displayName: "Dal fry", aliases: ["dal fry"], calories: 220, unit: "katori", preparationUncertain: true },
  { canonicalName: "instant noodles", displayName: "Instant noodles", aliases: ["instant noodles", "maggi", "maggie"], calories: 380, unit: "packet", preparationUncertain: true },
  { canonicalName: "hakka noodles", displayName: "Hakka noodles", aliases: ["hakka noodles", "chow mein", "chowmein"], calories: 420, unit: "plate", preparationUncertain: true },
  { canonicalName: "cold coffee", displayName: "Cold coffee", aliases: ["cold coffee", "iced coffee"], calories: 220, unit: "cup", preparationUncertain: true, assumption: "Assumes a medium cold coffee with 150 ml milk and 2 teaspoons sugar, without ice cream." },
  { canonicalName: "coffee", displayName: "Coffee", aliases: ["coffee", "hot coffee"], calories: 60, unit: "cup", preparationUncertain: true, assumption: "Assumes 100 ml milk and 1 teaspoon sugar per cup." },
  { canonicalName: "noodles", displayName: "Noodles", aliases: ["noodles", "noodle"], calories: 350, unit: "plate", preparationUncertain: true },
  { canonicalName: "idli", displayName: "Idli", aliases: ["idli", "idlis", "idly", "idlies"], calories: 60, unit: "piece" },
  { canonicalName: "sambar", displayName: "Sambar", aliases: ["sambar", "sambhar"], calories: 120, unit: "katori" },
  { canonicalName: "dosa", displayName: "Dosa", aliases: ["dosa", "dosas"], calories: 170, unit: "dosa", preparationUncertain: true },
  { canonicalName: "roti", displayName: "Roti", aliases: ["roti", "rotis", "chapati", "chapatis"], calories: 110, unit: "piece" },
  { canonicalName: "paratha", displayName: "Paratha", aliases: ["paratha", "parathas"], calories: 260, unit: "piece", preparationUncertain: true },
  { canonicalName: "poha", displayName: "Poha", aliases: ["poha"], calories: 250, unit: "katori", preparationUncertain: true },
  { canonicalName: "upma", displayName: "Upma", aliases: ["upma"], calories: 240, unit: "katori", preparationUncertain: true },
  { canonicalName: "rajma", displayName: "Rajma", aliases: ["rajma"], calories: 180, unit: "katori" },
  { canonicalName: "rice", displayName: "Rice", aliases: ["rice", "chawal"], calories: 210, unit: "katori" },
  { canonicalName: "curd", displayName: "Curd", aliases: ["curd", "dahi", "yogurt"], calories: 100, unit: "katori" },
  { canonicalName: "dal", displayName: "Dal", aliases: ["dal", "daal"], calories: 180, unit: "katori" },
  { canonicalName: "paneer", displayName: "Paneer", aliases: ["paneer"], calories: 300, unit: "katori", preparationUncertain: true },
  { canonicalName: "egg", displayName: "Egg", aliases: ["egg", "eggs"], calories: 78, unit: "piece" },
  { canonicalName: "omelette", displayName: "Omelette", aliases: ["omelette", "omelet"], calories: 220, unit: "piece", preparationUncertain: true },
  { canonicalName: "banana", displayName: "Banana", aliases: ["banana", "bananas"], calories: 105, unit: "piece" },
  { canonicalName: "apple", displayName: "Apple", aliases: ["apple", "apples"], calories: 95, unit: "piece" },
  { canonicalName: "toast", displayName: "Toast", aliases: ["toast", "bread"], calories: 90, unit: "piece" },
  { canonicalName: "tea", displayName: "Tea", aliases: ["tea", "chai"], calories: 90, unit: "cup", preparationUncertain: true, assumption: "Assumes 100 ml milk and 2 teaspoons sugar per cup." },
];

export function normalizeFoodName(value: string): string {
  return value.toLocaleLowerCase("en-IN").replace(/[_-]+/g, " ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function matchCatalogItem(name: string): FoodCatalogEntry | null {
  const normalized = normalizeFoodName(name);
  return FOOD_CATALOG.find((food) => food.canonicalName === normalized || food.aliases.some((alias) => normalizeFoodName(alias) === normalized)) ?? null;
}

export function findCatalogItemInText(text: string): FoodCatalogEntry | null {
  const normalized = ` ${normalizeFoodName(text)} `;
  const matches = FOOD_CATALOG.flatMap((food) => food.aliases.map((alias) => ({ food, alias: normalizeFoodName(alias) })))
    .sort((a, b) => b.alias.length - a.alias.length);
  return matches.find(({ alias }) => normalized.includes(` ${alias} `))?.food ?? null;
}
