/**
 * Presentation-only status config for purchase requests (requisitions) — badge
 * variant + label per status. Shared by the list, detail, and any other surface
 * that renders a purchase request status.
 */

import type { StatusConfig } from "@/components/shared/status-badge";
import type { PurchaseRequestStatus } from "@/features/purchase/types/purchase-request.types";

export const PR_STATUS: StatusConfig<PurchaseRequestStatus> = {
  draft: { label: "Draft", variant: "muted" },
  submitted: { label: "Submitted", variant: "info" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
  converted: { label: "Converted", variant: "success" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};
