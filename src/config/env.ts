import { z } from "zod";

/**
 * Environment variable validation.
 * Validates and exposes all required environment variables.
 * Throws at startup if any required variable is missing or malformed.
 *
 * Server-side variables: accessed only in server code (no NEXT_PUBLIC_ prefix)
 * Client-side variables: must have NEXT_PUBLIC_ prefix, safe to expose to browser
 */

const serverEnvSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required").optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().optional().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional().default("http://localhost:3000"),
});

function validateEnv() {
  const isServer = typeof window === "undefined";

  if (isServer) {
    const parsed = serverEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const formatted = parsed.error.format();
      console.error(
        "Invalid environment variables:",
        JSON.stringify(formatted, null, 2)
      );
      throw new Error("Invalid environment variables. Check server logs.");
    }
    return parsed.data;
  }

  // Client-side: only validate public variables
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!parsed.success) {
    const formatted = parsed.error.format();
    console.error(
      "Invalid public environment variables:",
      JSON.stringify(formatted, null, 2)
    );
    throw new Error("Invalid environment variables.");
  }

  return {
    ...parsed.data,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    NODE_ENV: (process.env.NODE_ENV ?? "development") as
      | "development"
      | "test"
      | "production",
  };
}

/**
 * Validated environment variables.
 * Use this instead of accessing process.env directly.
 *
 * @example
 * import { env } from "@/config/env";
 * const url = env.NEXT_PUBLIC_SUPABASE_URL;
 */
export const env = validateEnv();
