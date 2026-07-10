/**
 * Presentation-only mappings for purchase request (requisition) status —
 * badge variant and human-readable label. Shared by the list, detail, and
 * any other surface that renders a purchase request status.
 */

import type { BadgeProps } from "@/components/ui/badge";
import type { PurchaseRequestStatus } from "@/features/purchase/types/purchase-request.types";

export const PR_STATUS_VARIANT: Record<
  PurchaseRequestStatus,
  BadgeProps["variant"]
> = {
  draft: "muted",
  submitted: "info",
  approved: "success",
  rejected: "destructive",
  converted: "success",
  cancelled: "destructive",
};

export const PR_STATUS_LABEL: Record<PurchaseRequestStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  converted: "Converted",
  cancelled: "Cancelled",
};
