"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Package,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { exportProductsAction } from "@/features/product/actions/product.actions";
import { ProductImportDialog } from "@/features/product/components/product-import-dialog";
import type {
  Product,
  ProductListResult,
  ProductStatus,
  ProductType,
} from "@/features/product/types/product.types";

// ─────────────────────────────────────────────────────────────
// Status / type presentation
// ─────────────────────────────────────────────────────────────

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

const STATUS_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "discontinued", label: "Discontinued" },
  { value: "archived", label: "Archived" },
];

const TYPE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "", label: "All types" },
  { value: "inventory", label: "Inventory" },
  { value: "service", label: "Service" },
  { value: "digital", label: "Digital" },
  { value: "bundle", label: "Bundle" },
];

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface ProductsViewProps {
  readonly organizationId: string;
  readonly result: ProductListResult;
  readonly filters: {
    readonly search?: string;
    readonly status?: ProductStatus;
    readonly type?: ProductType;
  };
  readonly canManage: boolean;
}

export function ProductsView({
  organizationId,
  result,
  filters,
  canManage,
}: ProductsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [importOpen, setImportOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, startExport] = useTransition();

  const handleExport = (): void => {
    setExportError(null);
    startExport(async () => {
      const response = await exportProductsAction(organizationId);
      if (!response.success) {
        setExportError(response.error.message);
        return;
      }
      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "products.csv";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    });
  };

  const { items, total, page, pageSize } = result;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Builds the product detail href while preserving the active org param.
  const detailHref = (productId: string): string => {
    const org = searchParams.get("org");
    return org
      ? `/products/${productId}?org=${org}`
      : `/products/${productId}`;
  };

  const newHref = (): string => {
    const org = searchParams.get("org");
    return org ? `/products/new?org=${org}` : "/products/new";
  };

  const pushWith = (patch: Record<string, string | undefined>): void => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    const query = params.toString();
    router.push(query ? `/products?${query}` : "/products");
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    pushWith({ search: searchInput.trim() || undefined, page: undefined });
  };

  const handleStatusChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    pushWith({ status: event.target.value || undefined, page: undefined });
  };

  const handleTypeChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    pushWith({ type: event.target.value || undefined, page: undefined });
  };

  const goToPage = (next: number): void => {
    pushWith({ page: next <= 1 ? undefined : String(next) });
  };

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Products"
        description="Manage your product catalog, pricing and inventory"
        icon={Package}
      >
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleExport}
              loading={isExporting}
            >
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Export
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Import
            </Button>
            <Button asChild>
              <Link href={newHref()}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Add product
              </Link>
            </Button>
          </div>
        )}
      </PageHeader>

      {exportError && (
        <p
          role="alert"
          className="text-error-700 dark:text-error-300 bg-error-50 dark:bg-error-500/10 border-error-200 dark:border-error-500/30 mt-4 rounded-lg border px-3 py-2.5 text-sm"
        >
          {exportError}
        </p>
      )}

      {importOpen && (
        <ProductImportDialog
          organizationId={organizationId}
          onClose={() => setImportOpen(false)}
          onImported={() => router.refresh()}
        />
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          onSubmit={handleSearchSubmit}
          role="search"
          className="relative flex-1"
        >
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search products"
            placeholder="Search by name, code, SKU or barcode"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2.5 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 shadow-sm transition-colors hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </form>
        <select
          aria-label="Filter by type"
          value={filters.type ?? ""}
          onChange={handleTypeChange}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 shadow-sm transition-colors hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          value={filters.status ?? ""}
          onChange={handleStatusChange}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 shadow-sm transition-colors hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            icon={Package}
            title="No products found"
            description={
              filters.search || filters.status || filters.type
                ? "No products match your current filters. Try adjusting your search."
                : "Add your first product to start building your catalog."
            }
            action={
              canManage
                ? {
                    label: "Add product",
                    icon: Plus,
                    onClick: () => router.push(newHref()),
                  }
                : undefined
            }
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Code
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Name
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Type
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      SKU
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-medium"
                    >
                      Selling price
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((product: Product) => (
                    <tr
                      key={product.id}
                      onClick={() => router.push(detailHref(product.id))}
                      className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {product.code}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        <Link
                          href={detailHref(product.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline"
                        >
                          {product.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {TYPE_LABEL[product.type]}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[product.status]}>
                          {STATUS_LABEL[product.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {product.sku ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {formatCurrency(product.sellingPrice)}
                      </td>
                    </tr>
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
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "product" : "products"} · Page {page} of{" "}
            {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
