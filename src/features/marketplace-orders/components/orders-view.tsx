"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PlaceOrderForm } from "@/features/marketplace-orders/components/place-order-form";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
  formatMoney,
  shortId,
} from "@/features/marketplace-orders/components/order-format";
import { getOrderRole } from "@/features/marketplace-orders/services/order-state";
import type {
  MarketplaceOrder,
  OrderListResult,
  OrderPerspective,
  OrderStatus,
} from "@/features/marketplace-orders/types/marketplace-orders.types";

const PERSPECTIVE_OPTIONS: readonly { value: OrderPerspective; label: string }[] =
  [
    { value: "all", label: "All orders" },
    { value: "buying", label: "Buying" },
    { value: "selling", label: "Selling" },
  ];

const STATUS_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

interface OrderRowProps {
  readonly organizationId: string;
  readonly order: MarketplaceOrder;
}

function OrderRow({ organizationId, order }: OrderRowProps) {
  const role = getOrderRole(order, organizationId);
  const counterparty =
    role === "buyer" ? order.sellerOrganizationId : order.organizationId;

  return (
    <tr className="align-top transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <td className="px-4 py-3">
        <Link
          href={`/marketplace/orders/${order.id}`}
          className="font-medium text-primary hover:underline"
        >
          {shortId(order.id)}
        </Link>
        {order.notes && (
          <div className="max-w-xs truncate text-xs text-slate-500 dark:text-slate-400">
            {order.notes}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        {role && (
          <Badge variant={role === "buyer" ? "info" : "secondary"}>
            {role === "buyer" ? "Buying" : "Selling"}
          </Badge>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
        {shortId(counterparty)}
      </td>
      <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">{order.quantity}</td>
      <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">
        {formatMoney(order.totalAmount, order.currency)}
      </td>
      <td className="px-4 py-3">
        <Badge variant={ORDER_STATUS_VARIANT[order.status]}>
          {ORDER_STATUS_LABEL[order.status]}
        </Badge>
      </td>
    </tr>
  );
}

interface OrdersViewProps {
  readonly organizationId: string;
  readonly result: OrderListResult;
  readonly filters: {
    readonly perspective: OrderPerspective;
    readonly status?: OrderStatus;
  };
  readonly canTransact: boolean;
}

export function OrdersView({
  organizationId,
  result,
  filters,
  canTransact,
}: OrdersViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);

  const { items, total, page, pageSize } = result;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pushWith = useCallback(
    (patch: Record<string, string | undefined>): void => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(patch).forEach(([key, value]) => {
        if (value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      const query = params.toString();
      router.push(query ? `/marketplace/orders?${query}` : "/marketplace/orders");
    },
    [router, searchParams]
  );

  const handlePerspectiveChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>): void => {
      pushWith({ view: event.target.value || undefined, page: undefined });
    },
    [pushWith]
  );

  const handleStatusChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>): void => {
      pushWith({ status: event.target.value || undefined, page: undefined });
    },
    [pushWith]
  );

  const openForm = useCallback(() => {
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
  }, []);

  const handlePlaced = useCallback(() => {
    setFormOpen(false);
    router.refresh();
  }, [router]);

  const goPrev = useCallback(() => {
    pushWith({ page: page - 1 <= 1 ? undefined : String(page - 1) });
  }, [page, pushWith]);

  const goNext = useCallback(() => {
    pushWith({ page: String(page + 1) });
  }, [page, pushWith]);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Orders"
        description="Track the orders you place and receive across the network"
        icon={ShoppingCart}
      >
        {canTransact && !formOpen && (
          <Button type="button" onClick={openForm}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Place order
          </Button>
        )}
      </PageHeader>

      {formOpen && canTransact && (
        <div className="mt-6">
          <PlaceOrderForm
            organizationId={organizationId}
            onPlaced={handlePlaced}
            onCancel={closeForm}
          />
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          aria-label="Filter by perspective"
          value={filters.perspective}
          onChange={handlePerspectiveChange}
          className="focus:border-primary-500 focus:ring-primary-500 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors hover:border-slate-400 focus:outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600"
        >
          {PERSPECTIVE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          value={filters.status ?? ""}
          onChange={handleStatusChange}
          className="focus:border-primary-500 focus:ring-primary-500 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors hover:border-slate-400 focus:outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value || "all-status"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table / empty state */}
      <div className="mt-6">
        {items.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="No orders yet"
            description={
              filters.status || filters.perspective !== "all"
                ? "No orders match your current filters."
                : "Orders you place or receive on the marketplace will appear here."
            }
            action={
              canTransact
                ? { label: "Place order", icon: Plus, onClick: openForm }
                : undefined
            }
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Order
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Role
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Counterparty
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Qty
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Total
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((order) => (
                    <OrderRow
                      key={order.id}
                      organizationId={organizationId}
                      order={order}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>

      {/* Pagination */}
      {items.length > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-muted-foreground text-sm">
            {total} {total === 1 ? "order" : "orders"} · Page {page} of{" "}
            {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={goPrev}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={goNext}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
