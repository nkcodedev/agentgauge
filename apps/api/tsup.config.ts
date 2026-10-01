import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  sourcemap: true,
  clean: true,
  target: "node20",
  splitting: false,
  external: [
    "@agentgauge/core",
    "@agentgauge/db",
    "drizzle-orm",
    "fastify",
    "@fastify/cors",
    "zod",
    "postgres",
  ],
});
