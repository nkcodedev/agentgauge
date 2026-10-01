import { and, eq } from "drizzle-orm";
import type { Database } from "./client.js";
import { PRODUCTION_MODEL_PRICING } from "./pricing-seeds.js";
import { modelPricing } from "./schema.js";

export type PricingKind = "agentgauge_default" | "custom" | "override";
export type PricingWindowStatus = "active" | "historical" | "upcoming";

export class ModelPricingError extends Error {
  readonly statusCode: number;
  readonly code: "validation_error" | "conflict" | "not_found";

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "ModelPricingError";
    this.statusCode = statusCode;
    this.code =
      statusCode === 409 ? "conflict" : statusCode === 404 ? "not_found" : "validation_error";
  }
}

export interface ModelPricingView {
  readonly id: string;
  readonly provider: string;
  readonly model: string;
  readonly inputPricePerMillion: string;
  readonly outputPricePerMillion: string;
  readonly currency: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly source: string;
  readonly kind: PricingKind;
  readonly status: PricingWindowStatus;
}

export interface ListModelPricingQuery {
  readonly provider?: string;
  readonly model?: string;
  readonly q?: string;
  readonly status?: PricingWindowStatus;
  readonly source?: PricingKind;
  readonly now?: Date;
}

export interface PricingWriteInput {
  readonly provider: string;
  readonly model: string;
  readonly inputPricePerMillion: string;
  readonly outputPricePerMillion: string;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string | null;
}

export interface SupersedePricingInput {
  readonly inputPricePerMillion: string;
  readonly outputPricePerMillion: string;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string | null;
}

const PRICE = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,8})?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function pricingKind(source: string): PricingKind {
  if (source === "override") return "override";
  if (source === "custom") return "custom";
  return "agentgauge_default";
}

export function isAgentGaugeDefaultSource(source: string): boolean {
  return pricingKind(source) === "agentgauge_default";
}

export function pricingWindowStatus(
  effectiveFrom: Date,
  effectiveTo: Date | null,
  now: Date,
): PricingWindowStatus {
  if (effectiveTo && effectiveTo.getTime() <= effectiveFrom.getTime()) return "historical";
  if (effectiveFrom.getTime() > now.getTime()) return "upcoming";
  if (effectiveTo && effectiveTo.getTime() <= now.getTime()) return "historical";
  return "active";
}

export function isSeededModel(provider: string, model: string): boolean {
  return PRODUCTION_MODEL_PRICING.some((row) => row.provider === provider && row.model === model);
}

export function windowsOverlap(
  aFrom: Date,
  aTo: Date | null,
  bFrom: Date,
  bTo: Date | null,
): boolean {
  const aEnd = aTo ? aTo.getTime() : Number.POSITIVE_INFINITY;
  const bEnd = bTo ? bTo.getTime() : Number.POSITIVE_INFINITY;
  return aFrom.getTime() < bEnd && bFrom.getTime() < aEnd;
}

function fail(statusCode: number, message: string): never {
  throw new ModelPricingError(statusCode, message);
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) <= 0x1f) return true;
  }
  return false;
}

export function parsePrice(value: unknown, label: string): string {
  if (typeof value !== "string" || !PRICE.test(value.trim())) {
    fail(400, `${label} must be a non-negative decimal.`);
  }
  return value.trim();
}

function parseName(value: unknown, label: string, max: number): string {
  if (typeof value !== "string") fail(400, `${label} is required.`);
  const trimmed = value.trim();
  if (!trimmed) fail(400, `${label} is required.`);
  if (trimmed.length > max) fail(400, `${label} is too long.`);
  if (hasControlCharacter(trimmed)) fail(400, `${label} contains invalid characters.`);
  return trimmed;
}

function parseInstant(value: unknown, label: string): Date {
  if (typeof value !== "string" || !value.trim()) fail(400, `${label} is required.`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail(400, "Invalid effective date range.");
  return date;
}

function parseOptionalEnd(value: unknown, start: Date): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") fail(400, "Invalid effective date range.");
  const end = new Date(value);
  if (Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
    fail(400, "Invalid effective date range.");
  }
  return end;
}

function assertUuid(id: string): void {
  if (!UUID.test(id)) fail(404, "Pricing row not found.");
}

type PricingRow = typeof modelPricing.$inferSelect;

function toView(row: PricingRow, now: Date): ModelPricingView {
  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    inputPricePerMillion: String(row.inputPricePerMillion),
    outputPricePerMillion: String(row.outputPricePerMillion),
    currency: row.currency,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo ? row.effectiveTo.toISOString() : null,
    source: row.source,
    kind: pricingKind(row.source),
    status: pricingWindowStatus(row.effectiveFrom, row.effectiveTo, now),
  };
}

export async function listModelPricing(
  db: Database,
  query: ListModelPricingQuery = {},
): Promise<ModelPricingView[]> {
  const now = query.now ?? new Date();
  const rows = await db.select().from(modelPricing);
  return rows
    .map((row) => toView(row, now))
    .filter((row) => {
      if (query.provider && row.provider !== query.provider) return false;
      if (query.model && row.model !== query.model) return false;
      if (query.q && !row.model.toLowerCase().includes(query.q.trim().toLowerCase())) return false;
      if (query.status && row.status !== query.status) return false;
      if (query.source && row.kind !== query.source) return false;
      return true;
    })
    .sort((a, b) => {
      const provider = a.provider.localeCompare(b.provider);
      if (provider !== 0) return provider;
      const model = a.model.localeCompare(b.model);
      if (model !== 0) return model;
      return b.effectiveFrom.localeCompare(a.effectiveFrom);
    });
}

async function userRowsForModel(db: Database, provider: string, model: string) {
  return db
    .select()
    .from(modelPricing)
    .where(and(eq(modelPricing.provider, provider), eq(modelPricing.model, model)));
}

function assertNoUserOverlap(
  rows: readonly PricingRow[],
  start: Date,
  end: Date | null,
  ignoreId?: string,
): void {
  for (const row of rows) {
    if (ignoreId && row.id === ignoreId) continue;
    if (isAgentGaugeDefaultSource(row.source)) continue;
    if (windowsOverlap(start, end, row.effectiveFrom, row.effectiveTo)) {
      fail(409, "An active pricing period already overlaps this model.");
    }
  }
}

export async function createModelPricing(
  db: Database,
  input: PricingWriteInput,
): Promise<ModelPricingView> {
  const provider = parseName(input.provider, "Provider", 64);
  const model = parseName(input.model, "Model", 128);
  const inputPrice = parsePrice(input.inputPricePerMillion, "Input price");
  const outputPrice = parsePrice(input.outputPricePerMillion, "Output price");
  const effectiveFrom = parseInstant(input.effectiveFrom, "Effective from");
  const effectiveTo = parseOptionalEnd(input.effectiveTo, effectiveFrom);
  const source = isSeededModel(provider, model) ? "override" : "custom";

  const existing = await userRowsForModel(db, provider, model);
  assertNoUserOverlap(existing, effectiveFrom, effectiveTo);

  const inserted = (
    await db
      .insert(modelPricing)
      .values({
        provider,
        model,
        inputPricePerMillion: inputPrice,
        outputPricePerMillion: outputPrice,
        currency: "USD",
        effectiveFrom,
        effectiveTo,
        source,
      })
      .returning()
  )[0];
  if (!inserted) fail(400, "Pricing could not be saved.");
  return toView(inserted, new Date());
}

export async function supersedeModelPricing(
  db: Database,
  id: string,
  input: SupersedePricingInput,
): Promise<{ closed: ModelPricingView; created: ModelPricingView }> {
  assertUuid(id);
  const inputPrice = parsePrice(input.inputPricePerMillion, "Input price");
  const outputPrice = parsePrice(input.outputPricePerMillion, "Output price");
  const effectiveFrom = parseInstant(input.effectiveFrom, "Effective from");
  const effectiveTo = parseOptionalEnd(input.effectiveTo, effectiveFrom);

  return db.transaction(async (tx) => {
    const currentRows = await tx
      .select()
      .from(modelPricing)
      .where(eq(modelPricing.id, id))
      .limit(1);
    const current = currentRows[0];
    if (!current) fail(404, "Pricing row not found.");
    if (isAgentGaugeDefaultSource(current.source)) {
      fail(400, "AgentGauge default pricing is read-only. Add an override for this model instead.");
    }
    const now = new Date();
    if (pricingWindowStatus(current.effectiveFrom, current.effectiveTo, now) === "historical") {
      fail(400, "Historical pricing is read-only.");
    }
    if (effectiveFrom.getTime() <= current.effectiveFrom.getTime()) {
      fail(400, "Invalid effective date range.");
    }
    if (current.effectiveTo && effectiveFrom.getTime() >= current.effectiveTo.getTime()) {
      fail(400, "Invalid effective date range.");
    }

    const siblings = await tx
      .select()
      .from(modelPricing)
      .where(
        and(eq(modelPricing.provider, current.provider), eq(modelPricing.model, current.model)),
      );
    assertNoUserOverlap(siblings, effectiveFrom, effectiveTo, current.id);

    const closedRows = await tx
      .update(modelPricing)
      .set({ effectiveTo: effectiveFrom })
      .where(eq(modelPricing.id, current.id))
      .returning();
    const closed = closedRows[0];
    if (!closed) fail(400, "Pricing could not be saved.");

    const createdRows = await tx
      .insert(modelPricing)
      .values({
        provider: current.provider,
        model: current.model,
        inputPricePerMillion: inputPrice,
        outputPricePerMillion: outputPrice,
        currency: current.currency,
        effectiveFrom,
        effectiveTo,
        source: current.source,
      })
      .returning();
    const created = createdRows[0];
    if (!created) fail(400, "Pricing could not be saved.");
    return { closed: toView(closed, now), created: toView(created, now) };
  });
}

export async function resetModelPricingOverride(
  db: Database,
  id: string,
  now = new Date(),
): Promise<ModelPricingView> {
  assertUuid(id);
  const rows = await db.select().from(modelPricing).where(eq(modelPricing.id, id)).limit(1);
  const current = rows[0];
  if (!current) fail(404, "Pricing row not found.");
  if (current.source !== "override" || !isSeededModel(current.provider, current.model)) {
    fail(400, "Only an override of AgentGauge default pricing can be reset.");
  }
  if (pricingWindowStatus(current.effectiveFrom, current.effectiveTo, now) === "historical") {
    fail(400, "Historical pricing is read-only.");
  }

  const effectiveTo = current.effectiveFrom.getTime() > now.getTime() ? current.effectiveFrom : now;
  const updated = (
    await db
      .update(modelPricing)
      .set({ effectiveTo })
      .where(eq(modelPricing.id, current.id))
      .returning()
  )[0];
  if (!updated) fail(400, "Pricing could not be saved.");
  return toView(updated, now);
}
