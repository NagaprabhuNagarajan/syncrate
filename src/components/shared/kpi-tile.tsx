import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/utils/cn";

interface KpiTileProps {
  readonly icon: LucideIcon;
  readonly label: string;
  /** Numeric value — rendered as currency, or animated when `suffix` is set. */
  readonly value?: number;
  /** Gradient tint class (e.g. "bg-gradient-brand") for the top accent bar. */
  readonly tint: string;
  /** Position in the strip — drives the stagger animation delay. */
  readonly index: number;
  /** Larger value text for the primary tile. */
  readonly emphasis?: boolean;
  /** Render this string instead of the numeric value (e.g. a date). */
  readonly displayValue?: string;
  /** Append a unit after an animated count (e.g. "items"). */
  readonly suffix?: string;
  /** Fractional digits for the animated count (used with `suffix`). */
  readonly decimals?: number;
}

/**
 * The compact KPI metric tile used across detail / profile pages. A clean card
 * with a colored top accent, the label above a prominent value, and a muted
 * corner icon — deliberately distinct from the icon-forward list-page
 * `<StatTile>`. Renders, in precedence order: `displayValue` (any string), an
 * animated count with a `suffix`, or `value` as currency.
 */
export function KpiTile({
  icon: Icon,
  label,
  value = 0,
  tint,
  index,
  emphasis,
  displayValue,
  suffix,
  decimals = 0,
}: KpiTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
    >
      <Card className="relative h-full overflow-hidden p-4">
        {/* Colored top accent — the tile's only splash of the tint color. */}
        <div
          className={cn("absolute inset-x-0 top-0 h-1", tint)}
          aria-hidden="true"
        />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p
              className={cn(
                "mt-1.5 truncate font-bold leading-tight text-slate-900 dark:text-slate-100",
                emphasis ? "text-2xl" : "text-xl"
              )}
            >
              {displayValue !== undefined ? (
                displayValue
              ) : suffix ? (
                <>
                  <AnimatedNumber value={value} decimals={decimals} />
                  <span className="ml-1 text-xs font-medium text-muted-foreground">
                    {suffix}
                  </span>
                </>
              ) : (
                formatCurrency(value, true)
              )}
            </p>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

KpiTile.displayName = "KpiTile";
