"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { PenSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { ReputationBadge } from "@/features/reputation/components/ReputationBadge";
import { ReviewsList } from "@/features/reputation/components/ReviewsList";
import { WriteReviewForm } from "@/features/reputation/components/WriteReviewForm";
import type {
  ReputationSummary,
  Review,
  ReviewListItem,
} from "@/features/reputation/types/reputation.types";

interface ReputationViewProps {
  /** The viewing/reviewing organization. */
  readonly organizationId: string;
  readonly subjectOrganizationId: string;
  readonly subjectName: string;
  readonly summary: ReputationSummary;
  readonly reviews: readonly ReviewListItem[];
  /** True when the subject is the viewer's own organization. */
  readonly isOwnOrg: boolean;
  readonly canReview: boolean;
  /** The viewer's existing review of the subject, if any. */
  readonly existingReview: Review | null;
}

export function ReputationView({
  organizationId,
  subjectOrganizationId,
  subjectName,
  summary,
  reviews,
  isOwnOrg,
  canReview,
  existingReview,
}: ReputationViewProps) {
  const router = useRouter();
  const [isWriting, setIsWriting] = useState(false);

  const openForm = useCallback(() => {
    setIsWriting(true);
  }, []);

  const closeForm = useCallback(() => {
    setIsWriting(false);
  }, []);

  const handleSuccess = useCallback(() => {
    setIsWriting(false);
    router.refresh();
  }, [router]);

  // Reviewing is only possible for other organizations.
  const showReviewAction = canReview && !isOwnOrg;

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <PageHeader
        title={isOwnOrg ? "Your reputation" : `${subjectName} reputation`}
        description={
          isOwnOrg
            ? "How connected businesses rate your organization on the network."
            : `Reviews and reputation for ${subjectName}.`
        }
      >
        {showReviewAction && !isWriting && (
          <Button variant="gradient" onClick={openForm}>
            <PenSquare className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {existingReview ? "Edit your review" : "Write a review"}
          </Button>
        )}
      </PageHeader>

      <ReputationBadge summary={summary} variant="panel" />

      {showReviewAction && isWriting && (
        <WriteReviewForm
          organizationId={organizationId}
          subjectOrganizationId={subjectOrganizationId}
          subjectName={subjectName}
          existingReview={existingReview ?? undefined}
          onSuccess={handleSuccess}
          onCancel={closeForm}
        />
      )}

      <section aria-label="Reviews">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {summary.reviewCount} {summary.reviewCount === 1 ? "review" : "reviews"}
        </h2>
        <ReviewsList reviews={reviews} />
      </section>
    </div>
  );
}
