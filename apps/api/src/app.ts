import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { createDb, type Database } from "@agentgauge/db";
import { authenticateRequest, type AuthContext } from "./services/auth.js";
import { IngestBodySchema } from "./lib/trace-schema.js";
import { ingestEvent, ProjectMismatchError } from "./services/ingest.js";
import {
  getAgent,
  getTrace,
  getUsage,
  listAgents,
  listTraces,
  type UsageInterval,
} from "./services/query.js";
import { createApiKey, listApiKeys, revokeApiKey } from "./services/api-keys.js";
import { InMemoryRateLimiter } from "./lib/rate-limit.js";
import { defaultProjectEventBus, type ProjectEventBus } from "./lib/project-event-bus.js";
import { openApiDocument } from "./openapi.js";

const SSE_HEARTBEAT_MS = 20_000;

export interface BuildAppOptions {
  readonly databaseUrl?: string;
  readonly db?: Database;
  readonly rateLimitPerMinute?: number;
  /** Injectable for tests; defaults to process-wide in-memory bus. */
  readonly eventBus?: ProjectEventBus;
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

function parseDate(value: string | undefined, name: string): Date | undefined {
  if (value === undefined) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw Object.assign(new Error(`Invalid ${name} datetime`), { statusCode: 400 });
  }
  return d;
}

async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  db: Database,
): Promise<AuthContext | null> {
  const auth = await authenticateRequest(db, request.headers.authorization);
  if (!auth) {
    await reply.code(401).send({
      error: {
        code: "unauthorized",
        message: "Invalid or missing API key",
      },
    });
    return null;
  }
  request.auth = auth;
  return auth;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const db =
    options.db ??
    createDb(
      options.databaseUrl ??
        process.env.DATABASE_URL ??
        "postgresql://agentgauge:agentgauge@localhost:5432/agentgauge",
    );

  const rateLimiter = new InMemoryRateLimiter(options.rateLimitPerMinute ?? 600, 60_000);
  const eventBus = options.eventBus ?? defaultProjectEventBus;

  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
    bodyLimit: 256 * 1024,
    genReqId: () => crypto.randomUUID(),
  });

  await app.register(cors, { origin: true });

  app.setErrorHandler((error, _request, reply) => {
    const err = error as Error & { statusCode?: number };
    const statusCode = typeof err.statusCode === "number" ? err.statusCode : 500;
    if (statusCode >= 500) {
      app.log.error(err);
    }
    void reply.code(statusCode).send({
      error: {
        code: statusCode === 400 ? "bad_request" : statusCode === 401 ? "unauthorized" : "internal",
        message: statusCode >= 500 ? "Internal server error" : err.message,
      },
    });
  });

  app.get("/health", async () => ({ ok: true }));

  app.get("/openapi.json", async () => openApiDocument);

  app.addHook("preHandler", async (request, reply) => {
    if (!request.url.startsWith("/v1/")) return;
    const auth = await requireAuth(request, reply, db);
    if (!auth) return;

    // Long-lived SSE connections authenticate once and must not burn rate-limit budget
    // on heartbeats or EventSource reconnects.
    const pathOnly = request.url.split("?")[0] ?? request.url;
    if (pathOnly === "/v1/events/stream") return;

    const result = rateLimiter.check(auth.apiKey.id);
    void reply.header("x-ratelimit-limit", String(options.rateLimitPerMinute ?? 600));
    void reply.header("x-ratelimit-remaining", String(result.remaining));
    void reply.header("x-ratelimit-reset", String(Math.ceil(result.resetAt / 1000)));
    if (!result.allowed) {
      return reply.code(429).send({
        error: {
          code: "rate_limited",
          message: "Rate limit exceeded",
        },
      });
    }
  });

  async function handleIngest(request: FastifyRequest, reply: FastifyReply) {
    const auth = request.auth!;
    const parsed = IngestBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "validation_error",
          message: "Invalid batch payload",
          details: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
      });
    }

    const results = [];
    try {
      for (const event of parsed.data.events) {
        const result = await ingestEvent(db, auth.project, event);
        results.push(result);
        // Emit only after successful persistence of a new row — never for duplicates.
        if (!result.duplicate) {
          eventBus.publish(auth.project.id, {
            type: "trace.created",
            projectId: auth.project.id,
            agentId: event.agentId,
            eventId: event.eventId,
            occurredAt: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      if (error instanceof ProjectMismatchError) {
        return reply.code(400).send({
          error: { code: "project_mismatch", message: error.message },
        });
      }
      throw error;
    }

    return reply.code(202).send({
      accepted: true,
      eventIds: results.map((r) => r.eventId),
      duplicates: results.filter((r) => r.duplicate).map((r) => r.eventId),
    });
  }

  app.post("/v1/traces", handleIngest);
  app.post("/v1/traces/batch", handleIngest);

  /**
   * Project-scoped Server-Sent Events stream for dashboard live updates.
   * Payload is intentionally lightweight; clients refetch canonical APIs.
   */
  app.get("/v1/events/stream", async (request, reply) => {
    const auth = request.auth!;
    const projectId = auth.project.id;

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    reply.raw.write(": connected\n\n");

    const writeEvent = (eventName: string, data: unknown) => {
      reply.raw.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    writeEvent("ready", { projectId, occurredAt: new Date().toISOString() });

    const unsubscribe = eventBus.subscribe(projectId, (event) => {
      writeEvent(event.type, event);
    });

    const heartbeat = setInterval(() => {
      reply.raw.write(": heartbeat\n\n");
    }, SSE_HEARTBEAT_MS);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };

    request.raw.on("close", cleanup);
    request.raw.on("error", cleanup);
  });

  app.get("/v1/usage", async (request, reply) => {
    const auth = request.auth!;
    const query = request.query as { from?: string; to?: string; interval?: string };
    let from: Date | undefined;
    let to: Date | undefined;
    try {
      from = parseDate(query.from, "from");
      to = parseDate(query.to, "to");
    } catch (error) {
      return reply.code(400).send({
        error: {
          code: "bad_request",
          message: error instanceof Error ? error.message : "Invalid date",
        },
      });
    }
    let interval: UsageInterval | undefined;
    if (query.interval !== undefined) {
      if (query.interval !== "hour" && query.interval !== "day") {
        return reply.code(400).send({
          error: { code: "bad_request", message: "interval must be hour or day" },
        });
      }
      interval = query.interval;
    }
    const usage = await getUsage(
      db,
      auth.project.id,
      {
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      },
      interval,
    );
    return reply.send(usage);
  });

  app.get("/v1/agents", async (request, reply) => {
    const auth = request.auth!;
    const data = await listAgents(db, auth.project.id);
    return reply.send({ data });
  });

  app.get("/v1/agents/:agentId", async (request, reply) => {
    const auth = request.auth!;
    const { agentId } = request.params as { agentId: string };
    const agent = await getAgent(db, auth.project.id, agentId);
    if (!agent) {
      return reply.code(404).send({
        error: { code: "not_found", message: "Agent not found" },
      });
    }
    return reply.send(agent);
  });

  app.get("/v1/traces", async (request, reply) => {
    const auth = request.auth!;
    const query = request.query as {
      from?: string;
      to?: string;
      agentId?: string;
      provider?: string;
      model?: string;
      status?: string;
      limit?: string;
      cursor?: string;
    };
    let from: Date | undefined;
    let to: Date | undefined;
    try {
      from = parseDate(query.from, "from");
      to = parseDate(query.to, "to");
    } catch (error) {
      return reply.code(400).send({
        error: {
          code: "bad_request",
          message: error instanceof Error ? error.message : "Invalid date",
        },
      });
    }
    const result = await listTraces(db, auth.project.id, {
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(query.agentId ? { agentId: query.agentId } : {}),
      ...(query.provider ? { provider: query.provider } : {}),
      ...(query.model ? { model: query.model } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.limit ? { limit: Number(query.limit) } : {}),
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });
    return reply.send(result);
  });

  app.get("/v1/traces/:eventId", async (request, reply) => {
    const auth = request.auth!;
    const { eventId } = request.params as { eventId: string };
    const trace = await getTrace(db, auth.project.id, eventId);
    if (!trace) {
      return reply.code(404).send({
        error: { code: "not_found", message: "Trace not found" },
      });
    }
    return reply.send(trace);
  });

  app.get("/v1/api-keys", async (request, reply) => {
    const auth = request.auth!;
    const data = await listApiKeys(db, auth.project.id);
    return reply.send({ data });
  });

  app.post("/v1/api-keys", async (request, reply) => {
    const auth = request.auth!;
    const body = (request.body ?? {}) as { name?: string; environment?: "live" | "test" };
    if (typeof body.name !== "string") {
      return reply.code(400).send({
        error: { code: "validation_error", message: "name is required" },
      });
    }
    if (
      body.environment !== undefined &&
      body.environment !== "live" &&
      body.environment !== "test"
    ) {
      return reply.code(400).send({
        error: { code: "validation_error", message: "environment must be live or test" },
      });
    }
    try {
      const created = await createApiKey(db, auth.organization.id, auth.project.id, {
        name: body.name,
        ...(body.environment ? { environment: body.environment } : {}),
      });
      return reply.code(201).send(created);
    } catch (error) {
      const status =
        error instanceof Error && "statusCode" in error
          ? Number((error as { statusCode: number }).statusCode)
          : 500;
      return reply.code(status).send({
        error: {
          code: status === 400 ? "validation_error" : "internal",
          message: error instanceof Error ? error.message : "Failed to create key",
        },
      });
    }
  });

  app.post("/v1/api-keys/:id/revoke", async (request, reply) => {
    const auth = request.auth!;
    const { id } = request.params as { id: string };
    const revoked = await revokeApiKey(db, auth.project.id, id);
    if (!revoked) {
      return reply.code(404).send({
        error: { code: "not_found", message: "API key not found" },
      });
    }
    return reply.send(revoked);
  });

  return app;
}
