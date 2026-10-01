/**
 * Server-side cost calculation using decimal strings.
 * Prices are USD per 1,000,000 tokens.
 *
 * Rounding: half-up to 10 decimal places for stored costs.
 */

export interface CostInput {
  readonly provider?: string;
  readonly model?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly timestamp: Date;
}

export interface PricingRow {
  readonly provider: string;
  readonly model: string;
  readonly inputPricePerMillion: string;
  readonly outputPricePerMillion: string;
  readonly currency: string;
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
}

export interface CostResult {
  readonly inputCost: string | null;
  readonly outputCost: string | null;
  readonly totalCost: string | null;
  readonly currency: string | null;
  readonly status: "priced" | "unknown_model" | "no_usage";
}

function toScaledBigInt(value: string, scale: number): bigint {
  const negative = value.startsWith("-");
  const raw = negative ? value.slice(1) : value;
  const [whole = "0", frac = ""] = raw.split(".");
  const padded = (frac + "0".repeat(scale)).slice(0, scale);
  const n = BigInt(whole + padded);
  return negative ? -n : n;
}

function fromScaledBigInt(value: bigint, scale: number): string {
  const negative = value < 0n;
  const abs = value < 0n ? -value : value;
  const s = abs.toString().padStart(scale + 1, "0");
  const whole = s.slice(0, -scale) || "0";
  const frac = s.slice(-scale);
  const trimmed = frac.replace(/0+$/, "");
  const out = trimmed.length > 0 ? `${whole}.${trimmed}` : whole;
  return negative ? `-${out}` : out;
}

/** Round half-up to `decimals` places. */
export function roundHalfUp(value: string, decimals: number): string {
  const scale = decimals + 1;
  const scaled = toScaledBigInt(value, scale);
  const sign = scaled < 0n ? -1n : 1n;
  const abs = scaled < 0n ? -scaled : scaled;
  const last = abs % 10n;
  const truncated = abs / 10n;
  const rounded = last >= 5n ? truncated + 1n : truncated;
  return fromScaledBigInt(rounded * sign, decimals);
}

function mulDivTokens(tokens: number, pricePerMillion: string): string {
  const priceScaled = toScaledBigInt(pricePerMillion, 8);
  const numerator = BigInt(tokens) * priceScaled;
  const costScaled = numerator / 1_000_000n;
  const as8 = fromScaledBigInt(costScaled, 8);
  return roundHalfUp(as8, 10);
}

function addDecimal(a: string, b: string): string {
  const scale = 10;
  return fromScaledBigInt(toScaledBigInt(a, scale) + toScaledBigInt(b, scale), scale);
}

export function selectPricing(
  rows: readonly PricingRow[],
  provider: string,
  model: string,
  at: Date,
): PricingRow | undefined {
  const candidates = rows
    .filter(
      (r) =>
        r.provider === provider &&
        r.model === model &&
        r.effectiveFrom.getTime() <= at.getTime() &&
        (r.effectiveTo === null || r.effectiveTo.getTime() > at.getTime()),
    )
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
  return candidates[0];
}

export function calculateCost(input: CostInput, pricingRows: readonly PricingRow[]): CostResult {
  if (input.inputTokens === undefined && input.outputTokens === undefined) {
    return {
      inputCost: null,
      outputCost: null,
      totalCost: null,
      currency: null,
      status: "no_usage",
    };
  }

  if (!input.provider || !input.model) {
    return {
      inputCost: null,
      outputCost: null,
      totalCost: null,
      currency: null,
      status: "unknown_model",
    };
  }

  const pricing = selectPricing(pricingRows, input.provider, input.model, input.timestamp);
  if (!pricing) {
    return {
      inputCost: null,
      outputCost: null,
      totalCost: null,
      currency: null,
      status: "unknown_model",
    };
  }

  const inputTokens = input.inputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  const inputCost = mulDivTokens(inputTokens, pricing.inputPricePerMillion);
  const outputCost = mulDivTokens(outputTokens, pricing.outputPricePerMillion);
  const totalCost = roundHalfUp(addDecimal(inputCost, outputCost), 10);

  return {
    inputCost,
    outputCost,
    totalCost,
    currency: pricing.currency,
    status: "priced",
  };
}
