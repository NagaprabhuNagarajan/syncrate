// Reputation feature (CBN §17 Business Reputation) — public barrel.

export { ReputationBadge } from "@/features/reputation/components/ReputationBadge";
export { ReputationView } from "@/features/reputation/components/ReputationView";
export { ReviewsList } from "@/features/reputation/components/ReviewsList";
export { WriteReviewForm } from "@/features/reputation/components/WriteReviewForm";
export {
  StarRating,
  StarRatingInput,
} from "@/features/reputation/components/StarRating";

export { ReputationService } from "@/features/reputation/services/reputation.service";
export { ReputationRepository } from "@/features/reputation/repositories/reputation.repository";

export {
  getReputationAction,
  listReviewsAction,
  postReviewAction,
  updateReviewAction,
  deleteReviewAction,
} from "@/features/reputation/actions/reputation.actions";

export {
  createReviewSchema,
  updateReviewSchema,
} from "@/features/reputation/schemas/reputation.schemas";

export type {
  Review,
  ReputationSummary,
  ReviewListItem,
  CreateReviewInput,
  UpdateReviewInput,
  ListReviewsParams,
  ReputationActionResult,
  ReputationError,
  ReputationErrorCode,
} from "@/features/reputation/types/reputation.types";
