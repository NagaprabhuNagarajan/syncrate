import type { BadgeProps } from "@/components/ui/badge";
import type {
  OrderStatus,
  PaymentStatus,
} from "@/features/marketplace-orders/types/marketplace-orders.types";

export const ORDER_STATUS_VARIANT: Record<OrderStatus, BadgeProps["variant"]> = {
  pending: "warning",
  confirmed: "info",
  fulfilled: "info",
  completed: "success",
  cancelled: "muted",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  fulfilled: "Fulfilled",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_VARIANT: Record<PaymentStatus, BadgeProps["variant"]> =
  {
    pending: "warning",
    held: "info",
    released: "success",
    refunded: "secondary",
    failed: "destructive",
  };

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  held: "Held in escrow",
  released: "Released",
  refunded: "Refunded",
  failed: "Failed",
};

export const ORDER_ACTION_LABEL: Record<string, string> = {
  confirm: "Confirm",
  cancel: "Cancel",
  fulfil: "Mark fulfilled",
  complete: "Mark completed",
};

export const PAYMENT_ACTION_LABEL: Record<string, string> = {
  hold: "Pay into escrow",
  release: "Release to seller",
  refund: "Refund buyer",
};

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Shortens a UUID for compact display, e.g. "a1b2c3d4…". */
export function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}
