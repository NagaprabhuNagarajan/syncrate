import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/config/env";
import type { Database } from "@/types/database.types";

/**
 * Creates a Supabase client for use in Client Components.
 *
 * Use this in Client Components that need to interact with Supabase.
 * For Server Components, use the server client instead.
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
