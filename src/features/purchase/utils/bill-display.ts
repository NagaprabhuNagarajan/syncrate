/**
 * Presentation-only status config for bills — badge variant + label per status.
 * Shared by the list, detail, and any other surface that renders a bill status.
 */

import type { StatusConfig } from "@/components/shared/status-badge";
import type { BillStatus } from "@/features/purchase/types/bill.types";

export const BILL_STATUS: StatusConfig<BillStatus> = {
  draft: { label: "Draft", variant: "muted" },
  posted: { label: "Posted", variant: "success" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

// ─────────────────────────────────────────────────────────────
// Derived payment status
//
// Bills carry no `payment_status` column (unlike invoices), so it is derived
// on the fly from the money fields + due date. Rules, in priority order:
//   • paid    — fully settled (amountPaid covers the total)
//   • overdue — a posted bill still owing past its due date
//   • partial — some money paid, but not yet settled
//   • unpaid  — nothing paid
// ─────────────────────────────────────────────────────────────

export type BillPaymentStatus = "unpaid" | "partial" | "paid" | "overdue";

export function deriveBillPaymentStatus(bill: {
  totalAmount: number;
  amountPaid: number;
  dueDate: Date | null;
  status: BillStatus;
}): BillPaymentStatus {
  const { totalAmount, amountPaid, dueDate, status } = bill;
  const outstanding = totalAmount - amountPaid;

  if (totalAmount > 0 && amountPaid >= totalAmount) {
    return "paid";
  }
  if (
    status === "posted" &&
    outstanding > 0 &&
    dueDate &&
    new Date(dueDate) < new Date()
  ) {
    return "overdue";
  }
  if (amountPaid > 0) {
    return "partial";
  }
  return "unpaid";
}

export const BILL_PAYMENT_STATUS: StatusConfig<BillPaymentStatus> = {
  unpaid: { label: "Unpaid", variant: "warning" },
  partial: { label: "Partial", variant: "info" },
  paid: { label: "Paid", variant: "success" },
  overdue: { label: "Overdue", variant: "destructive" },
};
