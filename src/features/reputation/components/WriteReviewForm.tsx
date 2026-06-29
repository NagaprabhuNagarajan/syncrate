"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, Star, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { StarRatingInput } from "@/features/reputation/components/StarRating";
import {
  createReviewSchema,
  updateReviewSchema,
} from "@/features/reputation/schemas/reputation.schemas";
import {
  postReviewAction,
  updateReviewAction,
} from "@/features/reputation/actions/reputation.actions";
import type { Review } from "@/features/reputation/types/reputation.types";

const inputClass = cn(
  "block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500",
  "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-slate-400 dark:hover:border-slate-600"
);

interface WriteReviewFormProps {
  readonly organizationId: string;
  readonly subjectOrganizationId: string;
  readonly subjectName: string;
  readonly existingReview?: Review;
  readonly onSuccess?: () => void;
  readonly onCancel?: () => void;
}

export function WriteReviewForm({
  organizationId,
  subjectOrganizationId,
  subjectName,
  existingReview,
  onSuccess,
  onCancel,
}: WriteReviewFormProps) {
  const router = useRouter();
  const isEdit = Boolean(existingReview);
  const [rating, setRating] = useState<number>(existingReview?.rating ?? 0);
  const [title, setTitle] = useState<string>(existingReview?.title ?? "");
  const [comment, setComment] = useState<string>(existingReview?.comment ?? "");
  const [isRecommended, setIsRecommended] = useState<boolean>(
    existingReview?.isRecommended ?? true
  );
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value);
    },
    []
  );

  const handleCommentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setComment(e.target.value);
    },
    []
  );

  const toggleRecommend = useCallback(() => {
    setIsRecommended((prev) => !prev);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFieldError(null);
      setServerError(null);

      const fd = new FormData();
      fd.append("rating", String(rating));
      if (title.trim()) {
        fd.append("title", title.trim());
      }
      if (comment.trim()) {
        fd.append("comment", comment.trim());
      }
      fd.append("isRecommended", String(isRecommended));

      if (isEdit && existingReview) {
        const parsed = updateReviewSchema.safeParse({
          rating,
          title: title.trim(),
          comment: comment.trim(),
          isRecommended,
          version: existingReview.version,
        });
        if (!parsed.success) {
          setFieldError(parsed.error.errors[0]?.message ?? "Invalid input");
          return;
        }
        fd.append("version", String(existingReview.version));
      } else {
        fd.append("subjectOrganizationId", subjectOrganizationId);
        const parsed = createReviewSchema.safeParse({
          subjectOrganizationId,
          rating,
          title: title.trim(),
          comment: comment.trim(),
          isRecommended,
        });
        if (!parsed.success) {
          setFieldError(parsed.error.errors[0]?.message ?? "Invalid input");
          return;
        }
      }

      startTransition(async () => {
        const result =
          isEdit && existingReview
            ? await updateReviewAction(organizationId, existingReview.id, fd)
            : await postReviewAction(organizationId, fd);

        if (!result.success) {
          setServerError(result.error.message);
          return;
        }

        if (onSuccess) {
          onSuccess();
        } else {
          router.refresh();
        }
      });
    },
    [
      comment,
      existingReview,
      isEdit,
      isRecommended,
      onSuccess,
      organizationId,
      rating,
      router,
      subjectOrganizationId,
      title,
    ]
  );

  return (
    <motion.form
      onSubmit={handleSubmit}
      noValidate
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="space-y-5 rounded-2xl border border-slate-200/60 bg-white px-6 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div>
        <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {isEdit ? "Edit your review" : `Review ${subjectName}`}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Share your experience working with this business.
        </p>
      </div>

      {serverError && (
        <div
          className="border-error-200 bg-error-50 text-error-800 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
          role="alert"
        >
          <AlertCircle
            className="text-error-500 mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <span>{serverError}</span>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Rating
          <span className="text-error-500 ml-0.5" aria-hidden="true">
            *
          </span>
        </label>
        <StarRatingInput value={rating} onChange={setRating} />
      </div>

      <div>
        <label
          htmlFor="review-title"
          className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Title
        </label>
        <input
          id="review-title"
          type="text"
          value={title}
          onChange={handleTitleChange}
          className={inputClass}
          placeholder="Great supplier, fast delivery"
          maxLength={150}
        />
      </div>

      <div>
        <label
          htmlFor="review-comment"
          className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Comment
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={handleCommentChange}
          rows={4}
          className={inputClass}
          placeholder="Describe your experience…"
          maxLength={2000}
        />
      </div>

      <button
        type="button"
        onClick={toggleRecommend}
        aria-pressed={isRecommended}
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors",
          isRecommended
            ? "border-success-300 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300"
            : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600"
        )}
      >
        <ThumbsUp className="h-4 w-4" aria-hidden="true" />
        {isRecommended
          ? "I recommend this business"
          : "I do not recommend this business"}
      </button>

      {fieldError && (
        <p
          className="text-error-600 dark:text-error-400 flex items-center gap-1.5 text-xs"
          role="alert"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {fieldError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" loading={isPending} disabled={isPending}>
          <Star className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {isEdit ? "Save changes" : "Submit review"}
        </Button>
      </div>
    </motion.form>
  );
}
