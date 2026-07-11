/**
 * Presentation-only mappings for sales order status — badge variant and
 * human-readable label. Shared by the list, detail, and any other surface
 * that renders a sales order status.
 */

import type { BadgeProps } from "@/components/ui/badge";
import type { SalesOrderStatus } from "@/features/sales/types/sales-order.types";

export const SO_STATUS_VARIANT: Record<
  SalesOrderStatus,
  BadgeProps["variant"]
> = {
  draft: "muted",
  submitted: "info",
  approved: "success",
  processing: "info",
  partially_delivered: "warning",
  completed: "success",
  cancelled: "destructive",
};

export const SO_STATUS_LABEL: Record<SalesOrderStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  processing: "Processing",
  partially_delivered: "Partially delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};
