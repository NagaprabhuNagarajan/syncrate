/**
 * Presentation-only status config for purchase returns — badge variant + label
 * per status. Shared by the list, detail, and any other surface that renders a
 * purchase return status.
 */

import type { StatusConfig } from "@/components/shared/status-badge";
import type { PurchaseReturnStatus } from "@/features/purchase/types/purchase-return.types";

export const PRET_STATUS: StatusConfig<PurchaseReturnStatus> = {
  draft: { label: "Draft", variant: "muted" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};
