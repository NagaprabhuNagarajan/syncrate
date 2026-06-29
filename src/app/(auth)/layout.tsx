import type { Metadata } from "next";
import { BrandLogo } from "@/components/shared/logo";
import { AuthShowcase } from "@/components/shared/auth-showcase";

export const metadata: Metadata = {
  title: {
    template: "%s | Syncrate",
    default: "Syncrate",
  },
};

/**
 * Auth layout — split screen: branded showcase panel (lg+) beside the form.
 * Shared by: /login, /register, /forgot-password, /reset-password, /verify-email
 */
export default function AuthLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr] xl:grid-cols-[1.15fr_1fr]">
      {/* Left: branded showcase (desktop only) */}
      <AuthShowcase variant="auth" className="hidden lg:flex" />

      {/* Right: form area */}
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-10 sm:px-6 lg:px-8">
        {/* Soft background decoration */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-primary-100/60 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-indigo-100/60 blur-3xl" />
        </div>

        {/* Logo — shown when the showcase panel is hidden (mobile/tablet) */}
        <div className="relative z-10 mb-6 flex flex-col items-center lg:hidden">
          <BrandLogo size={132} priority />
        </div>

        {/* Card */}
        <div className="relative z-10 w-full max-w-md">{children}</div>

        {/* Footer */}
        <p className="relative z-10 mt-8 text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} Syncrate. All rights reserved.
        </p>
      </div>
    </div>
  );
}
