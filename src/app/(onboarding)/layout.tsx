import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | Syncrate Setup",
    default: "Syncrate Setup",
  },
};

/**
 * Onboarding layout — fullscreen gradient with a prominent centered form.
 * Slightly different from auth layout — has a progress indicator slot.
 */
export default function OnboardingLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-12 sm:px-6 lg:px-8">
      {/* Background decoration */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-primary-100/50 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-indigo-100/50 blur-3xl" />
        <div className="absolute left-1/2 top-1/4 h-64 w-64 -translate-x-1/2 rounded-full bg-sky-100/30 blur-3xl" />
      </div>

      {/* Logo + step indicator */}
      <div className="relative z-10 mb-8 flex flex-col items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 shadow-lg shadow-primary-600/20">
          <span className="text-xl font-bold text-white">S</span>
        </div>
        <span className="text-xl font-semibold text-slate-800 dark:text-slate-100">Syncrate</span>
        <p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Account Setup
        </p>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-xl">{children}</div>
    </div>
  );
}
