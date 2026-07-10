/**
 * Presentation-only mappings for purchase return status — badge variant and
 * human-readable label. Shared by the list, detail, and any other surface
 * that renders a purchase return status.
 */

import type { BadgeProps } from "@/components/ui/badge";
import type { PurchaseReturnStatus } from "@/features/purchase/types/purchase-return.types";

export const PRET_STATUS_VARIANT: Record<
  PurchaseReturnStatus,
  BadgeProps["variant"]
> = {
  draft: "muted",
  completed: "success",
  cancelled: "destructive",
};

export const PRET_STATUS_LABEL: Record<PurchaseReturnStatus, string> = {
  draft: "Draft",
  completed: "Completed",
  cancelled: "Cancelled",
};
