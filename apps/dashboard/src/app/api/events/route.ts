import { NextResponse } from "next/server";
import { getApiBaseUrl, getServerApiKey } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Server-side SSE proxy so the browser never receives AGENTGAUGE_API_KEY.
 * Streams bytes through without buffering the full response body.
 */
export async function GET() {
  let apiKey: string;
  try {
    apiKey = getServerApiKey();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "misconfigured",
          message: "AGENTGAUGE_API_KEY is not configured on the dashboard server",
        },
      },
      { status: 503 },
    );
  }

  const upstream = await fetch(`${getApiBaseUrl()}/v1/events/stream`, {
    headers: {
      accept: "text/event-stream",
      authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return new NextResponse(text || JSON.stringify({ error: { code: "upstream_error" } }), {
      status: upstream.status || 502,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
