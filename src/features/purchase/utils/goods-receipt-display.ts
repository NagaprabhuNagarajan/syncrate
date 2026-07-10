/**
 * Presentation-only mappings for goods receipt status — badge variant and
 * human-readable label. Shared by the list and any other surface that
 * renders a goods receipt status.
 */

import type { BadgeProps } from "@/components/ui/badge";
import type { GoodsReceiptStatus } from "@/features/purchase/types/goods-receipt.types";

export const GRN_STATUS_VARIANT: Record<
  GoodsReceiptStatus,
  BadgeProps["variant"]
> = {
  draft: "muted",
  completed: "success",
};

export const GRN_STATUS_LABEL: Record<GoodsReceiptStatus, string> = {
  draft: "Draft",
  completed: "Completed",
};
