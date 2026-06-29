import { MessageSquare, ThumbsUp } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { StarRating } from "@/features/reputation/components/StarRating";
import type { ReviewListItem } from "@/features/reputation/types/reputation.types";

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

interface ReviewCardProps {
  readonly review: ReviewListItem;
}

function ReviewCard({ review }: ReviewCardProps) {
  return (
    <li className="rounded-xl border border-slate-200/60 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {review.reviewerName}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <StarRating value={review.rating} size="sm" />
            <time className="text-xs text-slate-400">
              {DATE_FORMAT.format(review.createdAt)}
            </time>
          </div>
        </div>
        {review.isRecommended && (
          <span className="text-success-600 flex shrink-0 items-center gap-1 text-xs font-medium">
            <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
            Recommends
          </span>
        )}
      </div>

      {review.title && (
        <p className="mt-3 text-sm font-medium text-slate-800">
          {review.title}
        </p>
      )}
      {review.comment && (
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {review.comment}
        </p>
      )}
    </li>
  );
}

interface ReviewsListProps {
  readonly reviews: readonly ReviewListItem[];
}

/** Renders the public list of reviews for an organization. */
export function ReviewsList({ reviews }: ReviewsListProps) {
  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No reviews yet"
        description="When connected businesses review this organization, their feedback will appear here."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </ul>
  );
}
