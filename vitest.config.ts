import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/tests/setup.ts"],
    globals: true,
    // Placeholder public env so import-time env validation (src/config/env.ts)
    // succeeds for any test that transitively loads a server module. Mirrors the
    // placeholders used by the CI build job.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder-anon-key",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules",
        "src/tests",
        "**/*.d.ts",
        "**/*.config.*",
        "src/types/database.types.ts",
        ".next",
        "e2e/**",
        // Framework glue — exercised by E2E, not unit-tested:
        "src/app/**", // Next.js pages, layouts, route handlers
        "src/middleware.ts",
        "**/providers.tsx",
        "src/config/env.ts", // env validation runs at import time
        "src/lib/supabase/**", // thin Supabase client factories (browser/server)
        "**/types/**", // type-only modules (no executable code)
        "**/*.types.ts",
      ],
      thresholds: {
        // Target: 90%+ as per testing strategy
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e", "playwright-report"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      // `server-only` throws when imported outside a React Server Component;
      // under Vitest we exercise server modules directly, so map it to the
      // package's no-op stub.
      "server-only": resolve(__dirname, "./node_modules/server-only/empty.js"),
    },
  },
});
