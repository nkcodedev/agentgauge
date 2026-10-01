#!/usr/bin/env node
/**
 * Architecture-boundary check.
 * - @agentgauge/core must not import node / openai / anthropic / gemini / apps / db / fastify
 * - @agentgauge/node must not import openai / anthropic / gemini / apps / db / fastify
 * - provider packages must not import apps / db / fastify
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const backendForbidden = [
  { re: /from\s+["']@agentgauge\/db["']/, message: "must not import @agentgauge/db" },
  { re: /from\s+["']@agentgauge\/api["']/, message: "must not import @agentgauge/api" },
  { re: /from\s+["']fastify["']/, message: "must not import fastify" },
  { re: /from\s+["']drizzle-orm/, message: "must not import drizzle-orm" },
  { re: /from\s+["']postgres["']/, message: "must not import postgres" },
  { re: /from\s+["'][^"']*apps\//, message: "must not import apps/*" },
];

const checks = [
  {
    dir: path.join(root, "packages/core/src"),
    forbidden: [
      { re: /from\s+["']@agentgauge\/node["']/, message: "must not import @agentgauge/node" },
      { re: /from\s+["']@agentgauge\/openai["']/, message: "must not import @agentgauge/openai" },
      {
        re: /from\s+["']@agentgauge\/anthropic["']/,
        message: "must not import @agentgauge/anthropic",
      },
      { re: /from\s+["']@agentgauge\/gemini["']/, message: "must not import @agentgauge/gemini" },
      { re: /from\s+["']node:/, message: "must not import node: built-ins" },
      { re: /from\s+["']openai["']/, message: "must not import openai" },
      { re: /from\s+["']@anthropic-ai\/sdk["']/, message: "must not import @anthropic-ai/sdk" },
      { re: /from\s+["']@google\/genai["']/, message: "must not import @google/genai" },
      ...backendForbidden,
    ],
  },
  {
    dir: path.join(root, "packages/node/src"),
    forbidden: [
      {
        re: /from\s+["']@agentgauge\/openai["']/,
        message: "must not import @agentgauge/openai",
      },
      {
        re: /from\s+["']@agentgauge\/anthropic["']/,
        message: "must not import @agentgauge/anthropic",
      },
      { re: /from\s+["']@agentgauge\/gemini["']/, message: "must not import @agentgauge/gemini" },
      { re: /from\s+["']openai["']/, message: "must not import openai" },
      { re: /from\s+["']@anthropic-ai\/sdk["']/, message: "must not import @anthropic-ai/sdk" },
      { re: /from\s+["']@google\/genai["']/, message: "must not import @google/genai" },
      ...backendForbidden,
    ],
  },
  {
    dir: path.join(root, "packages/openai/src"),
    forbidden: [...backendForbidden],
  },
  {
    dir: path.join(root, "packages/anthropic/src"),
    forbidden: [...backendForbidden],
  },
  {
    dir: path.join(root, "packages/gemini/src"),
    forbidden: [...backendForbidden],
  },
  {
    dir: path.join(root, "apps/dashboard/src"),
    forbidden: [
      { re: /from\s+["']@agentgauge\/db["']/, message: "dashboard must not import @agentgauge/db" },
      { re: /from\s+["']drizzle-orm/, message: "dashboard must not import drizzle-orm" },
      { re: /from\s+["']postgres["']/, message: "dashboard must not import postgres" },
      { re: /from\s+["']fastify["']/, message: "dashboard must not import fastify" },
    ],
  },
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

const violations = [];

for (const check of checks) {
  const files = await walk(check.dir);
  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const pattern of check.forbidden) {
      if (pattern.re.test(source)) {
        violations.push(`${path.relative(root, file)}: ${pattern.message}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Architecture boundary check failed:");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log(
  "Architecture boundary check passed (core + node + openai + anthropic + gemini + dashboard).",
);
