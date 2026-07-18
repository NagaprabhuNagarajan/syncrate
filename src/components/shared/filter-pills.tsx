import { cn } from "@/utils/cn";

export interface FilterPillOption {
  readonly value: string;
  readonly label: string;
}

interface FilterPillsProps {
  /** Accessible name for the group, e.g. "Status" or "Payment". */
  readonly label: string;
  readonly options: readonly FilterPillOption[];
  /** Currently selected value ("" for the "All" pill). */
  readonly active: string;
  readonly onSelect: (value: string) => void;
}

/**
 * A row of rounded filter pills (tablist) used across the transaction list
 * pages (bills, invoices, payments, …) to filter by status.
 */
export function FilterPills({
  label,
  options,
  active,
  onSelect,
}: FilterPillsProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="tablist"
      aria-label={`Filter by ${label.toLowerCase()}`}
    >
      {options.map((option) => {
        const isActive = active === option.value;
        return (
          <button
            key={option.value || "all"}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(option.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              isActive
                ? "border-transparent bg-gradient-brand text-white shadow-glow-primary"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
