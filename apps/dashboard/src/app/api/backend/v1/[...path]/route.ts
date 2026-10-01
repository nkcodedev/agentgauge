import { NextResponse } from "next/server";
import { getApiBaseUrl, getServerApiKey } from "@/lib/env";

/**
 * Server-side BFF proxy so the project API key never ships to the browser.
 */
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxy(await context.params, _request);
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxy(await context.params, request);
}

async function proxy(params: { path: string[] }, request: Request) {
  try {
    const path = params.path.join("/");
    const incoming = new URL(request.url);
    const target = `${getApiBaseUrl()}/v1/${path}${incoming.search}`;
    const init: RequestInit = {
      method: request.method,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${getServerApiKey()}`,
      },
      cache: "no-store",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      const body = await request.text();
      if (body.length > 0) {
        init.body = body;
        (init.headers as Record<string, string>)["content-type"] = "application/json";
      }
    }
    const upstream = await fetch(target, init);
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "proxy_error",
          message: error instanceof Error ? error.message : "Proxy failed",
        },
      },
      { status: 500 },
    );
  }
}
