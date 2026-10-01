import { getApiBaseUrl, getServerApiKey } from "./env";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface UsageBreakdownRow {
  key: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  errors: number;
  averageLatencyMs: number;
}

export interface UsageSeriesPoint {
  bucket: string;
  requests: number;
  totalTokens: number;
  estimatedCost: number;
  errors: number;
}

export interface UsageResponse {
  from: string | null;
  to: string | null;
  interval: "hour" | "day" | null;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  errors: number;
  averageLatencyMs: number;
  activeAgents: number;
  byAgent: UsageBreakdownRow[];
  byModel: UsageBreakdownRow[];
  byProvider: UsageBreakdownRow[];
  series: UsageSeriesPoint[];
}

export interface AgentSummary {
  agentId: string;
  firstSeen: string;
  lastSeen: string;
  requestCount: number;
  totalTokens: number;
  estimatedCost: number;
  errorCount: number;
  averageLatencyMs: number;
}

export type RunStatus = "running" | "success" | "error" | "cancelled" | "timeout";

export interface RunSummary {
  id: string;
  name: string;
  agentId: string;
  status: RunStatus | string;
  startedAt: string;
  endedAt: string | null;
  requestCount: number;
  totalTokens: number;
  estimatedCost: number;
  hasUnknownCost: boolean;
  errorCount: number;
  retryCount: number;
  durationMs: number;
}

export interface RunDetail extends RunSummary {
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  traces?: TraceListItem[];
}

export interface TraceListItem {
  eventId: string;
  traceId: string;
  agentId: string;
  runId: string | null;
  operationId: string | null;
  attempt: number | null;
  provider: string | null;
  model: string | null;
  operationName: string | null;
  status: string;
  startedAt: string;
  endedAt: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  totalCost: string | null;
  currency: string | null;
  costStatus: string;
}

export interface TraceDetail extends TraceListItem {
  environment: string | null;
  errorName: string | null;
  errorMessage: string | null;
  errorCode: string | null;
  metadata: Record<string, unknown> | null;
  tags: string[] | null;
  sdkName: string;
  sdkVersion: string;
  inputCost: string | null;
  outputCost: string | null;
}

export interface ApiKeyListItem {
  id: string;
  name: string;
  prefix: string;
  environment: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface CreatedApiKey extends ApiKeyListItem {
  apiKey: string;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${getServerApiKey()}`,
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { error: { code: "invalid_json", message: text } };
    }
  }

  if (!response.ok) {
    const err = body as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(
      response.status,
      err?.error?.code ?? "error",
      err?.error?.message ?? `Request failed (${response.status})`,
    );
  }

  return body as T;
}

export function fetchUsage(params: {
  from?: string;
  to?: string;
  interval?: "hour" | "day";
}): Promise<UsageResponse> {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.interval) q.set("interval", params.interval);
  const qs = q.toString();
  return apiFetch(`/v1/usage${qs ? `?${qs}` : ""}`);
}

export function fetchAgents(): Promise<{ data: AgentSummary[] }> {
  return apiFetch("/v1/agents");
}

export function fetchAgent(agentId: string): Promise<AgentSummary> {
  return apiFetch(`/v1/agents/${encodeURIComponent(agentId)}`);
}

export function fetchTraces(params: {
  from?: string;
  to?: string;
  agentId?: string;
  runId?: string;
  provider?: string;
  model?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ data: TraceListItem[]; nextCursor: string | null }> {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.agentId) q.set("agentId", params.agentId);
  if (params.runId) q.set("runId", params.runId);
  if (params.provider) q.set("provider", params.provider);
  if (params.model) q.set("model", params.model);
  if (params.status) q.set("status", params.status);
  if (params.limit) q.set("limit", String(params.limit));
  if (params.cursor) q.set("cursor", params.cursor);
  const qs = q.toString();
  return apiFetch(`/v1/traces${qs ? `?${qs}` : ""}`);
}

export function fetchRuns(params: {
  agentId?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ data: RunSummary[]; nextCursor: string | null }> {
  const q = new URLSearchParams();
  if (params.agentId) q.set("agentId", params.agentId);
  if (params.status) q.set("status", params.status);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.limit) q.set("limit", String(params.limit));
  if (params.cursor) q.set("cursor", params.cursor);
  const qs = q.toString();
  return apiFetch(`/v1/runs${qs ? `?${qs}` : ""}`);
}

export function fetchRun(runId: string): Promise<RunDetail> {
  return apiFetch(`/v1/runs/${encodeURIComponent(runId)}`);
}

export function fetchTrace(eventId: string): Promise<TraceDetail> {
  return apiFetch(`/v1/traces/${encodeURIComponent(eventId)}`);
}

export function fetchApiKeys(): Promise<{ data: ApiKeyListItem[] }> {
  return apiFetch("/v1/api-keys");
}

export function createApiKey(input: {
  name: string;
  environment?: "live" | "test";
}): Promise<CreatedApiKey> {
  return apiFetch("/v1/api-keys", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function revokeApiKey(id: string): Promise<ApiKeyListItem> {
  return apiFetch(`/v1/api-keys/${encodeURIComponent(id)}/revoke`, {
    method: "POST",
  });
}
