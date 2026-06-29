"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  PackageCheck,
  Plus,
  Truck,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ShipmentForm } from "@/features/marketplace-logistics/components/shipment-form";
import { advanceShipmentAction } from "@/features/marketplace-logistics/actions/shipment.actions";
import type {
  Shipment,
  ShipmentListResult,
  ShipmentStatus,
  ShipmentTransitionTarget,
} from "@/features/marketplace-logistics/types/logistics.types";

// ─────────────────────────────────────────────────────────────
// Presentation maps
// ─────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<ShipmentStatus, BadgeProps["variant"]> = {
  pending: "muted",
  in_transit: "info",
  delivered: "success",
  cancelled: "destructive",
};

const STATUS_LABEL: Record<ShipmentStatus, string> = {
  pending: "Pending",
  in_transit: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "in_transit", label: "In transit" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

interface RowAction {
  readonly status: ShipmentTransitionTarget;
  readonly label: string;
  readonly variant: "default" | "outline";
}

/**
 * Computes the status actions available to the caller for a shipment, mirroring
 * the service's state machine + participant guard (shipper drives the lifecycle;
 * the recipient may only confirm delivery).
 */
function availableActions(
  shipment: Shipment,
  isShipper: boolean
): readonly RowAction[] {
  if (isShipper) {
    if (shipment.status === "pending") {
      return [
        { status: "in_transit", label: "Mark in transit", variant: "default" },
        { status: "cancelled", label: "Cancel", variant: "outline" },
      ];
    }
    if (shipment.status === "in_transit") {
      return [
        { status: "delivered", label: "Mark delivered", variant: "default" },
        { status: "cancelled", label: "Cancel", variant: "outline" },
      ];
    }
    return [];
  }
  // Recipient: can only confirm delivery while in transit.
  if (shipment.status === "in_transit") {
    return [
      { status: "delivered", label: "Confirm delivery", variant: "default" },
    ];
  }
  return [];
}

function ActionIcon({ status }: { readonly status: ShipmentTransitionTarget }) {
  if (status === "in_transit") {
    return <Truck className="mr-1.5 h-4 w-4" aria-hidden="true" />;
  }
  if (status === "delivered") {
    return <PackageCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />;
  }
  return <Ban className="mr-1.5 h-4 w-4" aria-hidden="true" />;
}
ActionIcon.displayName = "ActionIcon";

// ─────────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────────

interface ShipmentRowProps {
  readonly organizationId: string;
  readonly shipment: Shipment;
  readonly canManage: boolean;
}

function ShipmentRow({
  organizationId,
  shipment,
  canManage,
}: ShipmentRowProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isShipper = shipment.organizationId === organizationId;
  const actions = canManage ? availableActions(shipment, isShipper) : [];

  const advance = useCallback(
    (status: ShipmentTransitionTarget): void => {
      setError(null);
      startTransition(async () => {
        const response = await advanceShipmentAction(
          organizationId,
          shipment.id,
          status,
          shipment.version
        );
        if (!response.success) {
          setError(response.error.message);
          return;
        }
        router.refresh();
      });
    },
    [organizationId, shipment.id, shipment.version, router]
  );

  return (
    <tr className="align-top transition-colors hover:bg-slate-50">
      <td className="px-4 py-3">
        <div className="font-mono text-xs text-slate-700">
          {shipment.orderId}
        </div>
        {error && (
          <div role="alert" className="mt-1 text-xs text-error">
            {error}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1 text-sm text-slate-700">
          {isShipper ? (
            <ArrowUpRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
          ) : (
            <ArrowDownLeft
              className="h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
          )}
          {isShipper ? "Outbound" : "Inbound"}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-700">{shipment.carrier ?? "—"}</td>
      <td className="px-4 py-3 font-mono text-xs text-slate-700">
        {shipment.trackingNumber ?? "—"}
      </td>
      <td className="px-4 py-3">
        <Badge variant={STATUS_VARIANT[shipment.status]}>
          {STATUS_LABEL[shipment.status]}
        </Badge>
      </td>
      <td className="px-4 py-3">
        {actions.length > 0 ? (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {actions.map((action) => (
              <ShipmentActionButton
                key={action.status}
                action={action}
                disabled={isPending}
                onAdvance={advance}
                shipmentLabel={shipment.orderId}
              />
            ))}
          </div>
        ) : (
          <span className="block text-right text-xs text-slate-400">
            No actions
          </span>
        )}
      </td>
    </tr>
  );
}
ShipmentRow.displayName = "ShipmentRow";

// ─────────────────────────────────────────────────────────────
// Action button (named handler — no anonymous arrow fns in render)
// ─────────────────────────────────────────────────────────────

interface ShipmentActionButtonProps {
  readonly action: RowAction;
  readonly disabled: boolean;
  readonly shipmentLabel: string;
  readonly onAdvance: (status: ShipmentTransitionTarget) => void;
}

function ShipmentActionButton({
  action,
  disabled,
  shipmentLabel,
  onAdvance,
}: ShipmentActionButtonProps) {
  const handleClick = useCallback(() => {
    onAdvance(action.status);
  }, [action.status, onAdvance]);

  return (
    <Button
      type="button"
      variant={action.variant}
      size="sm"
      onClick={handleClick}
      disabled={disabled}
      aria-label={`${action.label} for order ${shipmentLabel}`}
    >
      <ActionIcon status={action.status} />
      {action.label}
    </Button>
  );
}
ShipmentActionButton.displayName = "ShipmentActionButton";

// ─────────────────────────────────────────────────────────────
// View
// ─────────────────────────────────────────────────────────────

interface ShipmentsViewProps {
  readonly organizationId: string;
  readonly result: ShipmentListResult;
  readonly filters: {
    readonly status?: ShipmentStatus;
  };
  readonly canManage: boolean;
}

export function ShipmentsView({
  organizationId,
  result,
  filters,
  canManage,
}: ShipmentsViewProps) {
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
      router.push(
        query ? `/marketplace/shipments?${query}` : "/marketplace/shipments"
      );
    },
    [router, searchParams]
  );

  const handleStatusChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>): void => {
      pushWith({ status: event.target.value || undefined, page: undefined });
    },
    [pushWith]
  );

  const openCreate = useCallback(() => {
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
  }, []);

  const handleSaved = useCallback(() => {
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
        title="Shipments"
        description="Track logistics for your marketplace orders"
        icon={Truck}
      >
        {canManage && (
          <Button type="button" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            New shipment
          </Button>
        )}
      </PageHeader>

      {formOpen && canManage && (
        <div className="mt-6">
          <ShipmentForm
            organizationId={organizationId}
            onSaved={handleSaved}
            onCancel={closeForm}
          />
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <select
          aria-label="Filter by status"
          value={filters.status ?? ""}
          onChange={handleStatusChange}
          className="focus:border-primary-500 focus:ring-primary-500 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors hover:border-slate-400 focus:outline-none focus:ring-2"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table / empty state */}
      <div className="mt-6">
        {items.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No shipments yet"
            description={
              filters.status
                ? "No shipments match the selected status."
                : "Create a shipment for an order you are selling to start tracking delivery."
            }
            action={
              canManage
                ? { label: "New shipment", icon: Plus, onClick: openCreate }
                : undefined
            }
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Order
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Direction
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Carrier
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Tracking
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((shipment) => (
                    <ShipmentRow
                      key={shipment.id}
                      organizationId={organizationId}
                      shipment={shipment}
                      canManage={canManage}
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
            {total} {total === 1 ? "shipment" : "shipments"} · Page {page} of{" "}
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
ShipmentsView.displayName = "ShipmentsView";
