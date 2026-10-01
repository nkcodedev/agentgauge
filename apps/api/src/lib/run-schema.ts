import { TERMINAL_RUN_STATUSES } from "@agentgauge/core";
import { z } from "zod";
import { metadataSuperRefine } from "./trace-schema.js";

export const CreateRunBodySchema = z
  .object({
    id: z.string().min(1).max(128).optional(),
    name: z.string().min(1).max(256),
    agentId: z.string().min(1).max(128),
    metadata: z.record(z.unknown()).optional(),
    startedAt: z.string().datetime({ offset: true }).optional(),
  })
  .superRefine((body, ctx) => metadataSuperRefine(body.metadata, ctx));

export const EndRunBodySchema = z
  .object({
    status: z.enum(TERMINAL_RUN_STATUSES),
    metadata: z.record(z.unknown()).optional(),
    endedAt: z.string().datetime({ offset: true }).optional(),
  })
  .superRefine((body, ctx) => metadataSuperRefine(body.metadata, ctx));

export type CreateRunBody = z.infer<typeof CreateRunBodySchema>;
export type EndRunBody = z.infer<typeof EndRunBodySchema>;
