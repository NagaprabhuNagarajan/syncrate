"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Pencil,
  Archive,
  AlertTriangle,
  ChevronLeft,
  Wallet,
  TrendingUp,
  Tag,
  Boxes,
  Layers,
  FolderOpen,
  Ruler,
  Factory,
  Hash,
  Percent,
  CheckCircle2,
  Barcode,
  ArrowDownToLine,
  ArrowUpToLine,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { archiveProductAction } from "@/features/product/actions/product.actions";
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  TYPE_LABEL,
} from "@/features/product/utils/product-display";
import { formatCurrency, formatDate } from "@/utils/format";
import type { Product } from "@/features/product/types/product.types";
import type { ProductOption } from "@/features/product/components/product-form";
import { cn } from "@/utils/cn";

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
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
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
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {productName}
              </span>
              ? Archived products cannot be added to new transactions.
            </p>
          </div>
        </div>

        {error && (
          <div
            className="border-error-200 bg-error-50 text-error-800 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300 mt-4 rounded-lg border px-4 py-3 text-sm"
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
// KPI tile
// ─────────────────────────────────────────────────────────────

function KpiTile({
  icon: Icon,
  label,
  value,
  tint,
  emphasis,
  suffix,
  index,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: number;
  readonly tint: string;
  readonly emphasis?: boolean;
  readonly suffix?: string;
  readonly index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
    >
      <Card className="relative h-full overflow-hidden p-3">
        <div
          className={cn(
            "absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-20 blur-2xl",
            tint
          )}
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-2.5">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm",
              tint
            )}
          >
            <Icon className="h-4 w-4 text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <p
              className={cn(
                "font-bold leading-tight text-slate-900 dark:text-slate-100",
                emphasis ? "text-lg" : "text-base"
              )}
            >
              {suffix ? (
                <>
                  <AnimatedNumber value={value} />
                  <span className="ml-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {suffix}
                  </span>
                </>
              ) : (
                formatCurrency(value, true)
              )}
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
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
  readonly icon: LucideIcon;
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
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-words text-slate-700 dark:text-slate-300">
          {value}
        </dd>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  children,
  delay,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay }}
    >
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {children}
      </Card>
    </motion.div>
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
    <TableRow>
      <TableCell className="text-slate-600 dark:text-slate-400">
        {label}
      </TableCell>
      <TableCell className="nums text-right font-medium text-slate-900 dark:text-slate-100">
        {formatCurrency(value, true)}
      </TableCell>
    </TableRow>
  );
}

// ─────────────────────────────────────────────────────────────
// Product profile
// ─────────────────────────────────────────────────────────────

interface ProductProfileOptions {
  readonly categories?: readonly ProductOption[];
  readonly brands?: readonly ProductOption[];
  readonly units?: readonly ProductOption[];
  readonly suppliers?: readonly ProductOption[];
}

interface ProductProfileProps {
  readonly product: Product;
  readonly organizationId: string;
  readonly canManage: boolean;
  readonly options?: ProductProfileOptions;
}

function resolveName(
  options: readonly ProductOption[] | undefined,
  id: string | null
): string | null {
  if (!id) {
    return null;
  }
  return options?.find((option) => option.id === id)?.name ?? null;
}

export function ProductProfile({
  product,
  organizationId,
  canManage,
  options,
}: ProductProfileProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showArchive, setShowArchive] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const org = searchParams.get("org");
  const withOrg = (path: string): string =>
    org ? `${path}${path.includes("?") ? "&" : "?"}org=${org}` : path;

  const editHref = withOrg(`/products/${product.id}/edit`);

  const handleArchive = () => {
    setArchiveError(null);
    startTransition(async () => {
      const result = await archiveProductAction(organizationId, product.id);
      if (!result.success) {
        setArchiveError(result.error.message);
        return;
      }
      setShowArchive(false);
      router.push(withOrg("/products"));
    });
  };

  const margin = product.sellingPrice - product.purchasePrice;
  const categoryName = resolveName(options?.categories, product.categoryId);
  const brandName = resolveName(options?.brands, product.brandId);
  const unitName = resolveName(options?.units, product.unitId);

  return (
    <div className="p-4 lg:p-6">
      {/* Back link */}
      <Link
        href={withOrg("/products")}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Products
      </Link>

      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-4 mb-5 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/80 lg:-mx-6 lg:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {product.name}
              </h1>
              <Badge dot variant={STATUS_VARIANT[product.status]}>
                {STATUS_LABEL[product.status]}
              </Badge>
              <Badge variant="info">{TYPE_LABEL[product.type]}</Badge>
            </div>
            <p className="font-mono text-xs text-slate-400 dark:text-slate-500">
              {product.code}
            </p>
          </div>

          {canManage && (
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={editHref}>
                  <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Edit
                </Link>
              </Button>
              {product.status !== "archived" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-error-600 hover:bg-error-50 hover:text-error-700 dark:text-error-400 dark:hover:bg-error-500/10 dark:hover:text-error-300"
                  onClick={() => {
                    setArchiveError(null);
                    setShowArchive(true);
                  }}
                >
                  <Archive className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Archive
                </Button>
              )}
            </div>
          )}
        </div>

        {product.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {product.tags.map((tag) => (
              <Badge key={tag} variant="muted" size="sm">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          icon={Wallet}
          label="Selling price"
          value={product.sellingPrice}
          tint="bg-gradient-brand"
          emphasis
          index={0}
        />
        <KpiTile
          icon={TrendingUp}
          label="Margin"
          value={margin}
          tint={margin >= 0 ? "bg-gradient-success" : "bg-gradient-error"}
          index={1}
        />
        <KpiTile
          icon={Tag}
          label="MRP"
          value={product.retailPrice}
          tint="bg-gradient-violet"
          index={2}
        />
        <KpiTile
          icon={Boxes}
          label="Opening stock"
          value={product.openingStock}
          tint="bg-gradient-info"
          suffix="units"
          index={3}
        />
      </div>

      {/* Two-column body */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
          >
            <Card className="overflow-hidden">
              <div className="px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Pricing
                </h2>
              </div>
              <Table
                className="[&_td]:px-5 [&_th]:px-5"
                wrapperClassName="rounded-none border-0 border-t border-slate-100 bg-transparent dark:border-slate-800"
              >
                <TableBody>
                  <PriceRow
                    label="Purchase price"
                    value={product.purchasePrice}
                  />
                  <PriceRow
                    label="Selling price"
                    value={product.sellingPrice}
                  />
                  <PriceRow
                    label="Retail price (MRP)"
                    value={product.retailPrice}
                  />
                  <PriceRow
                    label="Min. selling price"
                    value={product.minSellingPrice}
                  />
                </TableBody>
              </Table>
            </Card>
          </motion.div>

          {product.description && (
            <SectionCard title="Description" delay={0.15}>
              <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                {product.description}
              </p>
            </SectionCard>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <SectionCard title="Classification" delay={0.1}>
            <dl className="space-y-4">
              <InfoRow
                icon={Layers}
                label="Type"
                value={TYPE_LABEL[product.type]}
              />
              <InfoRow icon={FolderOpen} label="Category" value={categoryName} />
              <InfoRow icon={Tag} label="Brand" value={brandName} />
              <InfoRow icon={Ruler} label="Unit" value={unitName} />
              <InfoRow
                icon={Factory}
                label="Manufacturer"
                value={product.manufacturer}
              />
            </dl>
          </SectionCard>

          <SectionCard title="Tax" delay={0.15}>
            <dl className="space-y-4">
              <InfoRow icon={Hash} label="HSN code" value={product.hsnCode} />
              <InfoRow
                icon={Percent}
                label={product.gstRates.length > 1 ? "GST rates" : "GST rate"}
                value={
                  product.gstRates.length > 0
                    ? product.gstRates.map((r) => `${r}%`).join(", ")
                    : `${product.gstRate}%`
                }
              />
              <InfoRow
                icon={CheckCircle2}
                label="Tax inclusive"
                value={product.taxInclusive ? "Yes" : "No"}
              />
            </dl>
          </SectionCard>

          <SectionCard title="Inventory" delay={0.2}>
            <dl className="space-y-4">
              <InfoRow icon={Hash} label="SKU" value={product.sku} />
              <InfoRow
                icon={Barcode}
                label="Barcode"
                value={product.barcode}
              />
              <InfoRow
                icon={Boxes}
                label="Track inventory"
                value={product.trackInventory ? "Yes" : "No"}
              />
              <InfoRow
                icon={ArrowDownToLine}
                label="Reorder level"
                value={String(product.reorderLevel)}
              />
              <InfoRow
                icon={ArrowUpToLine}
                label="Max stock"
                value={String(product.maxStock)}
              />
              <InfoRow
                icon={Boxes}
                label="Opening stock"
                value={String(product.openingStock)}
              />
            </dl>
          </SectionCard>

          <SectionCard title="Details" delay={0.25}>
            <dl className="space-y-4">
              <InfoRow
                icon={CalendarClock}
                label="Added on"
                value={formatDate(product.createdAt)}
              />
              <InfoRow
                icon={CalendarClock}
                label="Last updated"
                value={formatDate(product.updatedAt)}
              />
            </dl>
          </SectionCard>
        </div>
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
