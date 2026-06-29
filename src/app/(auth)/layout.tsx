import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | Syncrate",
    default: "Syncrate",
  },
};

/**
 * Auth layout — centered card on a branded background.
 * Shared by: /login, /register, /forgot-password, /reset-password, /verify-email
 */
export default function AuthLayout({
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
        <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-primary-100/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-indigo-100/60 blur-3xl" />
      </div>

      {/* Logo */}
      <div className="relative z-10 mb-8 flex flex-col items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 shadow-lg shadow-primary-600/20">
          <span className="text-xl font-bold text-white">S</span>
        </div>
        <span className="text-xl font-semibold text-slate-800 dark:text-slate-100">Syncrate</span>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md">{children}</div>

      {/* Footer */}
      <p className="relative z-10 mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
        &copy; {new Date().getFullYear()} Syncrate. All rights reserved.
      </p>
    </div>
  );
}
