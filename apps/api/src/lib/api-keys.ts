import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const KEY_BYTES = 32;

export type ApiKeyEnvironment = "live" | "test";

/**
 * Generate a high-entropy AgentGauge API key.
 * Format: ag_<env>_<base64url secret>
 */
export function generateApiKey(environment: ApiKeyEnvironment = "live"): {
  plaintext: string;
  prefix: string;
  hash: string;
  environment: ApiKeyEnvironment;
} {
  const secret = randomBytes(KEY_BYTES).toString("base64url");
  const plaintext = `ag_${environment}_${secret}`;
  const prefix = plaintext.slice(0, 16);
  return {
    plaintext,
    prefix,
    hash: hashApiKey(plaintext),
    environment,
  };
}

/**
 * SHA-256 hash of the full API key.
 * Suitable for high-entropy random secrets (not user passwords).
 */
export function hashApiKey(
  plaintext: string,
  pepper = process.env.AGENTGAUGE_API_KEY_PEPPER ?? "",
): string {
  return createHash("sha256").update(`${pepper}:${plaintext}`).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function parseBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match?.[1]) return undefined;
  return match[1].trim();
}
