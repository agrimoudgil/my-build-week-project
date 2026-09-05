import { createHash, randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import type { ServerMealAnalysis } from "./meal-service.js";

export type WhatsAppMealRecord = {
  id: string;
  userId: string;
  description: string;
  status: "awaiting_confirmation";
  createdAt: string;
  items: ServerMealAnalysis["estimate"]["items"];
  calorieEstimate: number;
  calorieMin: number;
  calorieMax: number;
  assumptions: string[];
  confidence: ServerMealAnalysis["estimate"]["confidence"];
};

type BlobWriter = (pathname: string, body: string, options: { access: "private"; addRandomSuffix: false; token?: string }) => Promise<unknown>;

export function whatsappUserId(from: string): string {
  return createHash("sha256").update(from).digest("hex");
}

export async function saveWhatsAppMeal(
  from: string,
  analysis: ServerMealAnalysis,
  options: { token?: string; writer?: BlobWriter; now?: Date; id?: string } = {},
): Promise<WhatsAppMealRecord> {
  if (!from.trim()) throw new Error("missing_sender");
  const token = options.token ?? process.env.BLOB_READ_WRITE_TOKEN;
  if (!token && !options.writer) throw new Error("storage_unconfigured");
  const createdAt = (options.now ?? new Date()).toISOString();
  const record: WhatsAppMealRecord = {
    id: options.id ?? randomUUID(),
    userId: whatsappUserId(from),
    description: analysis.sourceText,
    status: "awaiting_confirmation",
    createdAt,
    items: analysis.estimate.items,
    calorieEstimate: analysis.estimate.calorieEstimate,
    calorieMin: analysis.estimate.calorieMin,
    calorieMax: analysis.estimate.calorieMax,
    assumptions: analysis.estimate.assumptions,
    confidence: analysis.estimate.confidence,
  };
  const pathname = `whatsapp-meals/${record.userId}/${createdAt.replaceAll(":", "-")}-${record.id}.json`;
  await (options.writer ?? put)(pathname, JSON.stringify(record), { access: "private", addRandomSuffix: false, token });
  return record;
}
