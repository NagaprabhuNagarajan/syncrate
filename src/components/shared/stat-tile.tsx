import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/utils/cn";

interface StatTileProps {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: number;
  /** Gradient tint class (e.g. "bg-gradient-brand") for the icon + blur. */
  readonly tint: string;
  /** Position in the strip — drives the stagger animation delay. */
  readonly index: number;
  /** Render the value as currency instead of an animated count. */
  readonly currency?: boolean;
}

/**
 * The KPI stat tile used across list pages (invoices, payments, orders, …):
 * a Card with a gradient-tinted icon, a blurred accent, and an animated
 * number (or currency) value. For the more compact detail-page variant use
 * `<KpiTile>`.
 */
export function StatTile({
  icon: Icon,
  label,
  value,
  tint,
  index,
  currency,
}: StatTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
    >
      <Card className="relative overflow-hidden p-4">
        <div
          className={cn(
            "absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl",
            tint
          )}
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm",
              tint
            )}
          >
            <Icon className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {currency ? formatCurrency(value) : <AnimatedNumber value={value} />}
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

StatTile.displayName = "StatTile";
