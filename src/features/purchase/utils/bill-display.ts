/**
 * Presentation-only mappings for bill status — badge variant and
 * human-readable label. Shared by the list, detail, and any other surface
 * that renders a bill status.
 */

import type { BadgeProps } from "@/components/ui/badge";
import type { BillStatus } from "@/features/purchase/types/bill.types";

export const BILL_STATUS_VARIANT: Record<
  BillStatus,
  BadgeProps["variant"]
> = {
  draft: "muted",
  posted: "success",
  cancelled: "destructive",
};

export const BILL_STATUS_LABEL: Record<BillStatus, string> = {
  draft: "Draft",
  posted: "Posted",
  cancelled: "Cancelled",
};
