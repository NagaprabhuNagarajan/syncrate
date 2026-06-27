"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Layers, Plus } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { BatchFormDialog } from "@/features/inventory/components/batch-form";
import type {
  Batch,
  BatchListResult,
  BatchStatus,
} from "@/features/inventory/types/batch.types";
import type { ProductOption } from "@/features/inventory/types/inventory.types";

const STATUS_VARIANT: Record<BatchStatus, BadgeProps["variant"]> = {
  active: "success",
  expired: "destructive",
  depleted: "muted",
};

const STATUS_LABEL: Record<BatchStatus, string> = {
  active: "Active",
  expired: "Expired",
  depleted: "Depleted",
};

const numberFormatter = new Intl.NumberFormat("en-IN");

function productName(
  products: readonly ProductOption[],
  productId: string
): string {
  const match = products.find((product) => product.id === productId);
  return match ? `${match.name} (${match.code})` : "—";
}

interface BatchesViewProps {
  readonly organizationId: string;
  readonly result: BatchListResult;
  readonly products: readonly ProductOption[];
  readonly canManage: boolean;
}

export function BatchesView({
  organizationId,
  result,
  products,
  canManage,
}: BatchesViewProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);

  const { items } = result;

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Batches"
        description="Track products by manufacturing batch and expiry"
        icon={Layers}
      >
        {canManage && (
          <Button
            type="button"
            onClick={() => setFormOpen(true)}
            disabled={products.length === 0}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Add batch
          </Button>
        )}
      </PageHeader>

      {formOpen && (
        <BatchFormDialog
          organizationId={organizationId}
          products={products}
          onClose={() => setFormOpen(false)}
          onDone={() => {
            setFormOpen(false);
            router.refresh();
          }}
        />
      )}

      <div className="mt-6">
        {items.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No batches yet"
            description="Add a batch to track manufacturing dates, expiry and remaining quantities."
            action={
              canManage && products.length > 0
                ? {
                    label: "Add batch",
                    icon: Plus,
                    onClick: () => setFormOpen(true),
                  }
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
                      Batch
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Product
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Mfg date
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Expiry
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-medium"
                    >
                      Received
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-medium"
                    >
                      Remaining
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((batch: Batch) => (
                    <tr key={batch.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                        {batch.batchNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {productName(products, batch.productId)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {batch.manufacturingDate ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {batch.expiryDate ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {numberFormatter.format(batch.receivedQuantity)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                        {numberFormatter.format(batch.remainingQuantity)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[batch.status]}>
                          {STATUS_LABEL[batch.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

BatchesView.displayName = "BatchesView";
