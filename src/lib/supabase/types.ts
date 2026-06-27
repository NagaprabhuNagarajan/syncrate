/**
 * Shared Supabase client type utilities.
 *
 * Use AppSupabaseClient instead of SupabaseClient<Database> to avoid
 * generic-arity mismatches between @supabase/supabase-js and @supabase/ssr.
 *
 * Both createClient (browser) and createServerClient (server) return the same
 * underlying SupabaseClient shape — this type captures it correctly.
 */
import { type createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type AppSupabaseClient = ReturnType<typeof createClient<Database>>;
