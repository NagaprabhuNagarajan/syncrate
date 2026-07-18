"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Package, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  transitionOrderAction,
  paymentAction,
} from "@/features/marketplace-orders/actions/marketplace-orders.actions";
import {
  getAvailableOrderActions,
  getAvailablePaymentActions,
  getOrderRole,
} from "@/features/marketplace-orders/services/order-state";
import {
  ORDER_ACTION_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
  PAYMENT_ACTION_LABEL,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_VARIANT,
  formatMoney,
  shortId,
} from "@/features/marketplace-orders/components/order-format";
import type {
  OrderAction,
  OrderWithPayment,
  PaymentAction,
} from "@/features/marketplace-orders/types/marketplace-orders.types";

// ─────────────────────────────────────────────────────────────
// Order transition actions
// ─────────────────────────────────────────────────────────────

interface OrderActionsProps {
  readonly organizationId: string;
  readonly orderId: string;
  readonly version: number;
  readonly actions: readonly OrderAction[];
}

function OrderActions({
  organizationId,
  orderId,
  version,
  actions,
}: OrderActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<OrderAction | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = useCallback(
    (action: OrderAction): void => {
      setError(null);
      setPendingAction(action);
      startTransition(async () => {
        const result = await transitionOrderAction(
          organizationId,
          orderId,
          action,
          version
        );
        setPendingAction(null);
        if (!result.success) {
          setError(result.error.message);
          return;
        }
        router.refresh();
      });
    },
    [organizationId, orderId, version, router]
  );

  if (actions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No actions are available to you for this order right now.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action}
            type="button"
            variant={action === "cancel" ? "outline" : "default"}
            size="sm"
            data-action={action}
            loading={isPending && pendingAction === action}
            disabled={isPending}
            onClick={() => run(action)}
          >
            {ORDER_ACTION_LABEL[action] ?? action}
          </Button>
        ))}
      </div>
      {error && (
        <div role="alert" className="mt-2 text-sm text-error">
          {error}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Payment panel
// ─────────────────────────────────────────────────────────────

interface PaymentPanelProps {
  readonly organizationId: string;
  readonly orderId: string;
  readonly data: OrderWithPayment;
  readonly actions: readonly PaymentAction[];
  readonly canTransact: boolean;
}

function PaymentPanel({
  organizationId,
  orderId,
  data,
  actions,
  canTransact,
}: PaymentPanelProps) {
  const router = useRouter();
  const { order, payment } = data;
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PaymentAction | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = useCallback(
    (action: PaymentAction): void => {
      setError(null);
      setPendingAction(action);
      startTransition(async () => {
        const result = await paymentAction(organizationId, orderId, action);
        setPendingAction(null);
        if (!result.success) {
          setError(result.error.message);
          return;
        }
        router.refresh();
      });
    },
    [organizationId, orderId, router]
  );

  return (
    <section
      aria-label="Payment"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-4 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Escrow payment
        </h2>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <dt className="text-slate-500 dark:text-slate-400">Status</dt>
        <dd>
          {payment ? (
            <StatusBadge
              variant={PAYMENT_STATUS_VARIANT[payment.status]}
              label={PAYMENT_STATUS_LABEL[payment.status]}
            />
          ) : (
            <Badge dot variant="muted">Not started</Badge>
          )}
        </dd>

        <dt className="text-slate-500 dark:text-slate-400">Amount</dt>
        <dd className="nums text-slate-800 dark:text-slate-100">
          {formatMoney(
            payment?.amount ?? order.totalAmount,
            payment?.currency ?? order.currency
          )}
        </dd>

        <dt className="text-slate-500 dark:text-slate-400">Provider</dt>
        <dd className="text-slate-800 dark:text-slate-100">{payment?.provider ?? "—"}</dd>

        <dt className="text-slate-500 dark:text-slate-400">Reference</dt>
        <dd className="break-all font-mono text-xs text-slate-600 dark:text-slate-400">
          {payment?.externalReference ?? "—"}
        </dd>
      </dl>

      {canTransact && actions.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action}
              type="button"
              variant={action === "refund" ? "outline" : "default"}
              size="sm"
              data-action={action}
              loading={isPending && pendingAction === action}
              disabled={isPending}
              onClick={() => run(action)}
            >
              {PAYMENT_ACTION_LABEL[action] ?? action}
            </Button>
          ))}
        </div>
      )}

      {error && (
        <div role="alert" className="mt-2 text-sm text-error">
          {error}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Detail view
// ─────────────────────────────────────────────────────────────

interface OrderDetailViewProps {
  readonly organizationId: string;
  readonly data: OrderWithPayment;
  readonly canTransact: boolean;
}

export function OrderDetailView({
  organizationId,
  data,
  canTransact,
}: OrderDetailViewProps) {
  const { order, payment } = data;
  const role = getOrderRole(order, organizationId);
  const orderActions = role ? getAvailableOrderActions(order.status, role) : [];
  const paymentActions = role
    ? getAvailablePaymentActions(payment?.status ?? null, role)
    : [];
  const counterparty =
    role === "buyer" ? order.sellerOrganizationId : order.organizationId;
  const unitPrice = order.quantity > 0 ? order.totalAmount / order.quantity : 0;

  return (
    <div className="p-4 lg:p-6">
      <Link
        href="/marketplace/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to orders
      </Link>

      <PageHeader
        title={`Order ${shortId(order.id)}`}
        description={
          role
            ? role === "buyer"
              ? "You are the buyer on this order"
              : "You are the seller on this order"
            : "Order details"
        }
        icon={Package}
      >
        <StatusBadge
          variant={ORDER_STATUS_VARIANT[order.status]}
          label={ORDER_STATUS_LABEL[order.status]}
        />
      </PageHeader>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Summary */}
        <section
          aria-label="Order summary"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2 dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">
            Summary
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <dt className="text-slate-500 dark:text-slate-400">Counterparty</dt>
            <dd className="col-span-1 font-mono text-xs text-slate-700 sm:col-span-2 dark:text-slate-300">
              {shortId(counterparty)}
            </dd>

            <dt className="text-slate-500 dark:text-slate-400">Listing</dt>
            <dd className="col-span-1 font-mono text-xs text-slate-700 sm:col-span-2 dark:text-slate-300">
              {order.listingId ? shortId(order.listingId) : "—"}
            </dd>

            <dt className="text-slate-500 dark:text-slate-400">Quantity</dt>
            <dd className="nums col-span-1 text-slate-800 sm:col-span-2 dark:text-slate-100">
              {order.quantity}
            </dd>

            <dt className="text-slate-500 dark:text-slate-400">Unit price</dt>
            <dd className="nums col-span-1 text-slate-800 sm:col-span-2 dark:text-slate-100">
              {formatMoney(unitPrice, order.currency)}
            </dd>

            <dt className="text-slate-500 dark:text-slate-400">Total</dt>
            <dd className="nums col-span-1 font-semibold text-slate-900 sm:col-span-2 dark:text-slate-100">
              {formatMoney(order.totalAmount, order.currency)}
            </dd>

            {order.notes && (
              <>
                <dt className="text-slate-500 dark:text-slate-400">Notes</dt>
                <dd className="col-span-1 text-slate-700 sm:col-span-2 dark:text-slate-300">
                  {order.notes}
                </dd>
              </>
            )}
          </dl>

          {canTransact && role && (
            <div className="mt-4 border-t border-slate-100 pt-5 dark:border-slate-800">
              <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                Actions
              </h3>
              <OrderActions
                organizationId={organizationId}
                orderId={order.id}
                version={order.version}
                actions={orderActions}
              />
            </div>
          )}
        </section>

        {/* Payment */}
        <PaymentPanel
          organizationId={organizationId}
          orderId={order.id}
          data={data}
          actions={paymentActions}
          canTransact={canTransact}
        />
      </div>
    </div>
  );
}
