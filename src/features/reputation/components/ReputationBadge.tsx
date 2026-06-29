import { ThumbsUp, MessageSquare } from "lucide-react";
import { cn } from "@/utils/cn";
import { StarRating } from "@/features/reputation/components/StarRating";
import type { ReputationSummary } from "@/features/reputation/types/reputation.types";

interface ReputationBadgeProps {
  readonly summary: ReputationSummary;
  /** Compact inline variant (for cards/rows) vs. full panel. */
  readonly variant?: "inline" | "panel";
  readonly className?: string;
}

/**
 * Reusable reputation display: average rating (stars), review count, and the
 * percentage of reviewers who recommend. Drop into any feature that has a
 * `ReputationSummary` (from `get_organization_reputation`).
 */
export function ReputationBadge({
  summary,
  variant = "inline",
  className,
}: ReputationBadgeProps) {
  const { averageRating, reviewCount, recommendPercent } = summary;
  const hasReviews = reviewCount > 0;

  if (variant === "inline") {
    return (
      <div
        className={cn("flex items-center gap-2 text-sm", className)}
        aria-label={`Reputation: ${averageRating.toFixed(1)} stars from ${reviewCount} reviews`}
      >
        <StarRating value={averageRating} size="sm" />
        <span className="font-semibold text-slate-900">
          {hasReviews ? averageRating.toFixed(1) : "—"}
        </span>
        <span className="text-slate-400">
          ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-slate-200/60 bg-white px-6 py-6 shadow-sm sm:flex-row sm:items-center sm:gap-8",
        className
      )}
    >
      <div className="flex flex-col items-center">
        <span className="text-4xl font-bold tracking-tight text-slate-900">
          {hasReviews ? averageRating.toFixed(1) : "—"}
        </span>
        <StarRating value={averageRating} size="md" className="mt-1.5" />
        <span className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
        </span>
      </div>

      <div className="hidden h-16 w-px bg-slate-100 sm:block" />

      <div className="flex flex-col items-center">
        <span className="flex items-center gap-2 text-2xl font-bold text-success-600">
          <ThumbsUp className="h-5 w-5" aria-hidden="true" />
          {hasReviews ? `${Math.round(recommendPercent)}%` : "—"}
        </span>
        <span className="mt-1.5 text-xs text-slate-400">recommend</span>
      </div>
    </div>
  );
}
