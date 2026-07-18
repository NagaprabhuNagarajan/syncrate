/**
 * Presentation-only status config for sales orders — badge variant + label per
 * status. Shared by the list, detail, and any other surface that renders a
 * sales order status.
 */

import type { StatusConfig } from "@/components/shared/status-badge";
import type { SalesOrderStatus } from "@/features/sales/types/sales-order.types";

export const SO_STATUS: StatusConfig<SalesOrderStatus> = {
  draft: { label: "Draft", variant: "muted" },
  submitted: { label: "Submitted", variant: "info" },
  approved: { label: "Approved", variant: "success" },
  processing: { label: "Processing", variant: "info" },
  partially_delivered: {
    label: "Partially delivered",
    variant: "warning",
  },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};
