# Passwordless Auth — Email OTP

Syncrate uses **passwordless login**: users enter their email, receive a
**6-digit code**, and verifying the code signs them in. There are no passwords.

- New user (no organization yet) → redirected to **Account Setup**
  (`/create-organization`).
- Existing user → **Dashboard**.

Both are handled automatically by the `/dashboard` guard after a verified
session — the auth code does not branch on new-vs-existing.

## How it works in code

| Piece | File |
| --- | --- |
| Send code | `AuthService.requestEmailOtp` → `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })` |
| Verify code | `AuthService.verifyEmailOtp` → `supabase.auth.verifyOtp({ email, token, type: "email" })` |
| Server actions | `requestOtpAction`, `verifyOtpAction` in `auth.actions.ts` |
| UI (two-step) | `login-form.tsx` (email → code) |

`shouldCreateUser: true` provisions the auth user on first login; the
`on_auth_user_created` trigger then creates the `public.users` profile row.

## One-time hosted-project setup (Supabase Dashboard)

The code is complete, but the **hosted project must be configured** so the
email contains a code rather than a magic link. This is free.

1. **Authentication → Email Templates → "Magic Link"**
   Replace the link body with the OTP token, e.g.:

   ```html
   <h2>Your Syncrate login code</h2>
   <p>Enter this code to sign in:</p>
   <p style="font-size:24px;font-weight:700;letter-spacing:4px">{{ .Token }}</p>
   <p>This code expires in 10 minutes.</p>
   ```

   The key change is using `{{ .Token }}` (the 6-digit code) instead of
   `{{ .ConfirmationURL }}`.

2. **Authentication → Providers → Email**
   - Ensure **Email** provider is enabled.
   - Set **OTP expiry** to `600` seconds (10 min).
   - "Confirm email" can stay on — with OTP, verifying the code *is* the
     confirmation.

3. **(Production only — still free) Custom SMTP**
   The built-in email sender is rate-limited (~2–4/hour, testing only). For
   real volume connect a free-tier SMTP under **Authentication → SMTP
   Settings**:
   - **Resend** — 3,000 emails/month free
   - **Brevo** — 300 emails/day free

## Local development

`supabase/config.toml` sets `otp_length = 6` and `otp_expiry = 600` under
`[auth.email]`. With `supabase start`, OTP emails are captured by **Inbucket**
(local mailbox) at http://localhost:54324 — no real email is sent.

## Future: phone / SMS OTP

The `users.phone` column already exists. Phone login is an additive change when
ready, but SMS is **not free**: it requires a paid gateway (Twilio, etc.) and,
in India, DLT registration. Not implemented for that reason.
