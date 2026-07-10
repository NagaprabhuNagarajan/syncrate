/**
 * Presentation-only mappings for purchase order status — badge variant and
 * human-readable label. Shared by the list, detail, and any other surface
 * that renders a purchase order status.
 */

import type { BadgeProps } from "@/components/ui/badge";
import type { PurchaseOrderStatus } from "@/features/purchase/types/purchase-order.types";

export const PO_STATUS_VARIANT: Record<
  PurchaseOrderStatus,
  BadgeProps["variant"]
> = {
  draft: "muted",
  submitted: "info",
  approved: "success",
  ordered: "info",
  partially_received: "warning",
  completed: "success",
  cancelled: "destructive",
};

export const PO_STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  ordered: "Ordered",
  partially_received: "Partially received",
  completed: "Completed",
  cancelled: "Cancelled",
};
