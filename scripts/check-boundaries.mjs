#!/usr/bin/env node
/**
 * Lightweight architecture-boundary check for Milestone 1.
 * Ensures @agentgauge/core stays free of Node SDK / Node builtins / apps imports.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coreSrc = path.join(root, "packages/core/src");

const forbiddenPatterns = [
  { re: /from\s+["']@agentgauge\/node["']/, message: "must not import @agentgauge/node" },
  { re: /from\s+["']node:/, message: "must not import node: built-ins" },
  { re: /from\s+["']openai["']/, message: "must not import openai" },
  { re: /from\s+["'][^"']*apps\//, message: "must not import apps/*" },
  { re: /require\(\s*["']node:/, message: "must not require node: built-ins" },
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

const files = await walk(coreSrc);
const violations = [];

for (const file of files) {
  const source = await readFile(file, "utf8");
  for (const pattern of forbiddenPatterns) {
    if (pattern.re.test(source)) {
      violations.push(`${path.relative(root, file)}: ${pattern.message}`);
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

console.log("Architecture boundary check passed (@agentgauge/core).");
