"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Package,
  Pencil,
  Archive,
  AlertTriangle,
  Barcode,
  Factory,
  Tag,
  Hash,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { archiveProductAction } from "@/features/product/actions/product.actions";
import type {
  Product,
  ProductStatus,
  ProductType,
} from "@/features/product/types/product.types";

const STATUS_VARIANT: Record<ProductStatus, BadgeProps["variant"]> = {
  draft: "muted",
  active: "success",
  discontinued: "warning",
  archived: "secondary",
};

const STATUS_LABEL: Record<ProductStatus, string> = {
  draft: "Draft",
  active: "Active",
  discontinued: "Discontinued",
  archived: "Archived",
};

const TYPE_LABEL: Record<ProductType, string> = {
  inventory: "Inventory",
  service: "Service",
  digital: "Digital",
  bundle: "Bundle",
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

// ─────────────────────────────────────────────────────────────
// Archive confirmation dialog
// ─────────────────────────────────────────────────────────────

interface ArchiveDialogProps {
  readonly productName: string;
  readonly isPending: boolean;
  readonly error: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function ArchiveDialog({
  productName,
  isPending,
  error,
  onConfirm,
  onCancel,
}: ArchiveDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-product-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl"
      >
        <div className="flex items-start gap-4">
          <div className="bg-error-50 dark:bg-error-500/10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <AlertTriangle
              className="text-error-600 dark:text-error-400 h-5 w-5"
              aria-hidden="true"
            />
          </div>
          <div>
            <h2
              id="archive-product-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Archive product
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Are you sure you want to archive{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">{productName}</span>?
              Archived products cannot be added to new transactions.
            </p>
          </div>
        </div>

        {error && (
          <div
            className="border-error-200 dark:border-error-500/30 bg-error-50 dark:bg-error-500/10 text-error-800 dark:text-error-300 mt-4 rounded-lg border px-4 py-3 text-sm"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            loading={isPending}
            disabled={isPending}
          >
            Archive product
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Info row
// ─────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  readonly icon: typeof Tag;
  readonly label: string;
  readonly value: string | null;
}) {
  if (!value) {
    return null;
  }
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-slate-700 dark:text-slate-300">{value}</dd>
      </div>
    </div>
  );
}

function PriceRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums text-slate-900 dark:text-slate-100">
        {formatCurrency(value)}
      </dd>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Product profile
// ─────────────────────────────────────────────────────────────

interface ProductProfileProps {
  readonly product: Product;
  readonly organizationId: string;
  readonly canManage: boolean;
}

export function ProductProfile({
  product,
  organizationId,
  canManage,
}: ProductProfileProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showArchive, setShowArchive] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const org = searchParams.get("org");
  const editHref = org
    ? `/products/${product.id}/edit?org=${org}`
    : `/products/${product.id}/edit`;

  const handleArchive = () => {
    setArchiveError(null);
    startTransition(async () => {
      const result = await archiveProductAction(organizationId, product.id);
      if (!result.success) {
        setArchiveError(result.error.message);
        return;
      }
      setShowArchive(false);
      router.push("/products");
    });
  };

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title={product.name}
        description={product.code}
        icon={Package}
      >
        {canManage && (
          <>
            <Button asChild variant="outline">
              <Link href={editHref}>
                <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Edit
              </Link>
            </Button>
            {product.status !== "archived" && (
              <Button
                type="button"
                variant="ghost"
                className="text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-500/10 hover:text-error-700 dark:hover:text-error-300"
                onClick={() => {
                  setArchiveError(null);
                  setShowArchive(true);
                }}
              >
                <Archive className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Archive
              </Button>
            )}
          </>
        )}
      </PageHeader>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_VARIANT[product.status]}>
          {STATUS_LABEL[product.status]}
        </Badge>
        <Badge variant="info">{TYPE_LABEL[product.type]}</Badge>
        {product.tags.map((tag) => (
          <Badge key={tag} variant="muted">
            {tag}
          </Badge>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Details */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Product details
          </h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoRow
              icon={Factory}
              label="Manufacturer"
              value={product.manufacturer}
            />
            <InfoRow icon={Hash} label="SKU" value={product.sku} />
            <InfoRow
              icon={Barcode}
              label="Barcode"
              value={product.barcode}
            />
            <InfoRow
              icon={Tag}
              label="Track inventory"
              value={product.trackInventory ? "Yes" : "No"}
            />
          </dl>
          {product.description && (
            <div className="mt-5 border-t border-slate-100 dark:border-slate-800 pt-4">
              <dt className="text-xs text-muted-foreground">Description</dt>
              <dd className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                {product.description}
              </dd>
            </div>
          )}

          <div className="mt-5 border-t border-slate-100 dark:border-slate-800 pt-4">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Tax
            </h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground">GST rate</dt>
                <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {product.gstRate}%
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground">Tax inclusive</dt>
                <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {product.taxInclusive ? "Yes" : "No"}
                </dd>
              </div>
              {product.hsnCode && (
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-muted-foreground">HSN code</dt>
                  <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {product.hsnCode}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </Card>

        {/* Pricing */}
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Pricing</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-muted-foreground">Selling price</dt>
              <dd className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(product.sellingPrice)}
              </dd>
            </div>
            <div className="space-y-2.5 border-t border-slate-100 dark:border-slate-800 pt-3">
              <PriceRow label="Purchase price" value={product.purchasePrice} />
              <PriceRow label="Dealer price" value={product.dealerPrice} />
              <PriceRow
                label="Wholesale price"
                value={product.wholesalePrice}
              />
              <PriceRow label="Retail price / MRP" value={product.retailPrice} />
              <PriceRow
                label="Min. selling price"
                value={product.minSellingPrice}
              />
            </div>
          </dl>
        </Card>
      </div>

      <AnimatePresence>
        {showArchive && (
          <ArchiveDialog
            productName={product.name}
            isPending={isPending}
            error={archiveError}
            onConfirm={handleArchive}
            onCancel={() => setShowArchive(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
