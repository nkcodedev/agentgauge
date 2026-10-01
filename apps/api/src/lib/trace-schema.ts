import {
  FORBIDDEN_METADATA_CONTENT_KEYS,
  normalizeMetadata,
  ValidationError,
} from "@agentgauge/core";
import { z } from "zod";

const MAX_METADATA_KEYS = 32;
const MAX_METADATA_DEPTH = 3;
const MAX_STRING = 512;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 64;
const FORBIDDEN_METADATA_KEYS = new Set<string>(FORBIDDEN_METADATA_CONTENT_KEYS);

function assertDepth(value: unknown, depth: number): void {
  if (depth > MAX_METADATA_DEPTH) {
    throw new Error("metadata nesting too deep");
  }
  if (Array.isArray(value)) {
    for (const item of value) assertDepth(item, depth + 1);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      assertDepth(v, depth + 1);
    }
  }
}

export function metadataSuperRefine(
  metadata: Record<string, unknown> | undefined,
  ctx: z.RefinementCtx,
): void {
  if (!metadata) return;
  if (Object.keys(metadata).length > MAX_METADATA_KEYS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `metadata may have at most ${MAX_METADATA_KEYS} keys`,
    });
  }
  try {
    assertDepth(metadata, 0);
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `metadata nesting exceeds ${MAX_METADATA_DEPTH} levels`,
    });
  }
  const serialized = JSON.stringify(metadata);
  if (serialized.length > 8_192) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "metadata payload too large",
    });
  }
  for (const [k, v] of Object.entries(metadata)) {
    if (FORBIDDEN_METADATA_KEYS.has(k)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `metadata key "${k}" is not supported`,
      });
    }
    if (k.length > MAX_STRING) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "metadata key too long" });
    }
    if (typeof v === "string" && v.length > MAX_STRING) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "metadata string value too long" });
    }
  }
  try {
    normalizeMetadata(metadata);
  } catch (error) {
    const message = error instanceof ValidationError ? error.message : "metadata failed validation";
    ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  }
}

export const TraceEventSchema = z
  .object({
    eventId: z.string().min(1).max(128),
    traceId: z.string().min(1).max(128),
    agentId: z.string().min(1).max(128),
    project: z.string().min(1).max(128).optional(),
    environment: z.string().min(1).max(64).optional(),
    provider: z.string().min(1).max(64).optional(),
    model: z.string().min(1).max(128).optional(),
    operationName: z.string().min(1).max(128).optional(),
    runId: z.string().min(1).max(128).optional(),
    operationId: z.string().min(1).max(128).optional(),
    attempt: z.number().int().min(1).max(1_000_000).optional(),
    startedAt: z.string().datetime({ offset: true }),
    endedAt: z.string().datetime({ offset: true }),
    latencyMs: z.number().int().min(0).max(86_400_000),
    status: z.enum(["success", "error"]),
    usage: z
      .object({
        inputTokens: z.number().int().min(0).max(100_000_000).optional(),
        outputTokens: z.number().int().min(0).max(100_000_000).optional(),
        totalTokens: z.number().int().min(0).max(200_000_000).optional(),
      })
      .optional(),
    error: z
      .object({
        name: z.string().max(128).optional(),
        message: z.string().max(2048).optional(),
        code: z.string().max(128).optional(),
      })
      .optional(),
    metadata: z.record(z.unknown()).optional(),
    tags: z.array(z.string().min(1).max(MAX_TAG_LENGTH)).max(MAX_TAGS).optional(),
    sdk: z.object({
      name: z.string().min(1).max(128),
      version: z.string().min(1).max(64),
    }),
  })
  .superRefine((event, ctx) => metadataSuperRefine(event.metadata, ctx));

export const IngestBodySchema = z.object({
  events: z.array(TraceEventSchema).min(1).max(100),
});

export type IngestTraceEvent = z.infer<typeof TraceEventSchema>;
