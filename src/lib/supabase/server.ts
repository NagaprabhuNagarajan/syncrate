import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/config/env";
import type { Database } from "@/types/database.types";
import type { AppSupabaseClient } from "@/lib/supabase/types";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

/**
 * Creates a Supabase client for use in Server Components, Server Actions, and Route Handlers.
 *
 * IMPORTANT: This must be called inside an async Server Component or Route Handler.
 * Never import and use this at module level — it reads cookies at request time.
 *
 * Security: This client respects Row Level Security (RLS) using the user's JWT.
 * The Service Role key is NEVER used here. Never expose the service role key to the client.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              // CookieOptions from @supabase/ssr is compatible at runtime with Next.js ResponseCookie
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              cookieStore.set(name, value, options as any)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}

/**
 * Creates a Supabase admin client using the Service Role key.
 *
 * WARNING: This client bypasses Row Level Security.
 * ONLY use in trusted server-side code (background jobs, migrations, admin actions).
 * NEVER expose this in client-facing code or public API routes.
 *
 * Uses the plain (non-SSR) client with NO cookies: the SSR client would attach
 * the request's user JWT as the Authorization header, which overrides the
 * service_role key and re-applies RLS. A cookieless client sends the
 * service_role key for auth, so it genuinely bypasses RLS.
 */
export function createServiceRoleClient(): AppSupabaseClient {
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. This client requires the service role key."
    );
  }

  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
