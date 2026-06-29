"use client";

import { motion } from "framer-motion";
import { Network, Sparkles, BarChart3, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/shared/logo";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/utils/cn";

/**
 * Branded showcase panel for the split-screen auth & onboarding layouts.
 * Fills the otherwise-empty side with brand identity + product highlights.
 * Always rendered on the brand gradient (white text) so it is theme-agnostic.
 * Motion is tasteful and honored against reduced-motion (global CSS guard).
 */

const FEATURES = [
  {
    icon: Network,
    title: "Connected Business Network",
    desc: "Exchange structured digital transactions — not PDFs.",
  },
  {
    icon: Sparkles,
    title: "AI-powered operations",
    desc: "OCR capture, forecasting, and an assistant built in.",
  },
  {
    icon: BarChart3,
    title: "Inventory to invoicing",
    desc: "Run your entire business from a single platform.",
  },
  {
    icon: ShieldCheck,
    title: "Enterprise-grade security",
    desc: "RBAC, audit trails, and strict tenant isolation.",
  },
] as const;

export function AuthShowcase({
  variant = "auth",
  className,
}: {
  readonly variant?: "auth" | "onboarding";
  readonly className?: string;
}) {
  const headline =
    variant === "onboarding"
      ? "Let's set up your workspace"
      : "The Connected Business Operating System";
  const sub =
    variant === "onboarding"
      ? "A few quick steps and your organization is ready to run on Syncrate."
      : "Sync. Connect. Grow. — the AI-powered platform modern SMEs run on.";

  return (
    <div
      className={cn(
        "relative isolate flex-col overflow-hidden bg-gradient-brand",
        className
      )}
    >
      {/* Ambient aurora + grid */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-1/4 h-96 w-96 rounded-full bg-white/20 blur-3xl animate-[aurora-drift_18s_ease-in-out_infinite]" />
        <div className="absolute -right-16 bottom-0 h-[28rem] w-[28rem] rounded-full bg-indigo-300/30 blur-3xl animate-[aurora-drift-2_22s_ease-in-out_infinite]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.14),transparent_42%)]" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:42px_42px]" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-between p-10 text-white xl:p-14">
        {/* Brand lockup */}
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <BrandMark size={22} priority />
          </span>
          <span className="text-lg font-bold tracking-tight">Syncrate</span>
        </div>

        {/* Headline + feature highlights */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="max-w-md"
        >
          <motion.h2
            variants={staggerItem}
            className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl"
          >
            {headline}
          </motion.h2>
          <motion.p
            variants={staggerItem}
            className="mt-3 text-sm text-white/80 xl:text-base"
          >
            {sub}
          </motion.p>

          <ul className="mt-8 space-y-2.5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <motion.li
                  key={f.title}
                  variants={staggerItem}
                  className="flex items-start gap-3 rounded-xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur-sm"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                    <Icon className="h-4 w-4 text-white" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="text-xs text-white/70">{f.desc}</p>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </motion.div>

        {/* Trust footer */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-white/70">
          <span>GST-ready</span>
          <span className="h-1 w-1 rounded-full bg-white/40" aria-hidden="true" />
          <span>Multi-tenant</span>
          <span className="h-1 w-1 rounded-full bg-white/40" aria-hidden="true" />
          <span>Audit-logged</span>
          <span className="h-1 w-1 rounded-full bg-white/40" aria-hidden="true" />
          <span>Real-time</span>
        </div>
      </div>
    </div>
  );
}

AuthShowcase.displayName = "AuthShowcase";
