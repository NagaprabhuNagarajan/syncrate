import type { Metadata } from "next";
import { BrandLogo } from "@/components/shared/logo";
import { AuthShowcase } from "@/components/shared/auth-showcase";

export const metadata: Metadata = {
  title: {
    template: "%s | Syncrate Setup",
    default: "Syncrate Setup",
  },
};

/**
 * Onboarding layout — split screen: branded showcase panel (lg+) beside the
 * setup form. Mirrors the auth layout for a consistent first-run experience.
 */
export default function OnboardingLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr] xl:grid-cols-[1.15fr_1fr]">
      {/* Left: branded showcase (desktop only) */}
      <AuthShowcase variant="onboarding" className="hidden lg:flex" />

      {/* Right: content area */}
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-10 sm:px-6 lg:px-8">
        {/* Soft background decoration */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-primary-100/50 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-indigo-100/50 blur-3xl" />
          <div className="absolute left-1/2 top-1/4 h-64 w-64 -translate-x-1/2 rounded-full bg-sky-100/30 blur-3xl" />
        </div>

        {/* Logo + step indicator — shown when showcase panel is hidden */}
        <div className="relative z-10 mb-6 flex flex-col items-center">
          <div className="lg:hidden">
            <BrandLogo size={132} priority />
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-xl">{children}</div>
      </div>
    </div>
  );
}
