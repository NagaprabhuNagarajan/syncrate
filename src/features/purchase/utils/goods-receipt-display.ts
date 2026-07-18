/**
 * Presentation-only status config for goods receipts — badge variant + label
 * per status. Shared by the list and any other surface that renders a goods
 * receipt status.
 */

import type { StatusConfig } from "@/components/shared/status-badge";
import type { GoodsReceiptStatus } from "@/features/purchase/types/goods-receipt.types";

export const GRN_STATUS: StatusConfig<GoodsReceiptStatus> = {
  draft: { label: "Draft", variant: "muted" },
  completed: { label: "Completed", variant: "success" },
};
