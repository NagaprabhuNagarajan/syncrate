import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Auth callback — completes email confirmation / magic-link / OAuth by turning
 * the URL token into a session, then redirecting into the app.
 *
 * Supports both Supabase email-link shapes:
 *  - PKCE / code flow:   ?code=...
 *  - OTP / token_hash:   ?token_hash=...&type=signup|email|recovery|...
 *
 * Without this route the confirmation link lands on a blank page and the user
 * is never signed in.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  const supabase = await createServerSupabaseClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Token missing/expired/invalid — send to login with a hint.
  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
