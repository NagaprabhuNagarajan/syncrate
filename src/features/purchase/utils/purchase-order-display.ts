/**
 * Presentation-only status config for purchase orders — badge variant + label
 * per status. Shared by the list, detail, and any other surface that renders a
 * purchase order status.
 */

import type { StatusConfig } from "@/components/shared/status-badge";
import type { PurchaseOrderStatus } from "@/features/purchase/types/purchase-order.types";

export const PO_STATUS: StatusConfig<PurchaseOrderStatus> = {
  draft: { label: "Draft", variant: "muted" },
  submitted: { label: "Submitted", variant: "info" },
  approved: { label: "Approved", variant: "success" },
  ordered: { label: "Ordered", variant: "info" },
  partially_received: { label: "Partially received", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};
