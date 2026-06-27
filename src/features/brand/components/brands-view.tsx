"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Tag,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Archive,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { BrandForm } from "@/features/brand/components/brand-form";
import { archiveBrandAction } from "@/features/brand/actions/brand.actions";
import type {
  Brand,
  BrandListResult,
  BrandStatus,
} from "@/features/brand/types/brand.types";

// ─────────────────────────────────────────────────────────────
// Status presentation
// ─────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<BrandStatus, BadgeProps["variant"]> = {
  active: "success",
  archived: "secondary",
};

const STATUS_LABEL: Record<BrandStatus, string> = {
  active: "Active",
  archived: "Archived",
};

const STATUS_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface BrandsViewProps {
  readonly organizationId: string;
  readonly result: BrandListResult;
  readonly filters: {
    readonly search?: string;
    readonly status?: BrandStatus;
  };
  readonly canManage: boolean;
}

type FormMode = { readonly kind: "create" } | { readonly kind: "edit"; readonly brand: Brand };

export function BrandsView({
  organizationId,
  result,
  filters,
  canManage,
}: BrandsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isArchiving, startArchive] = useTransition();

  const { items, total, page, pageSize } = result;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
    router.push(query ? `/products/brands?${query}` : "/products/brands");
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

  const goToPage = (next: number): void => {
    pushWith({ page: next <= 1 ? undefined : String(next) });
  };

  const handleArchive = (brand: Brand): void => {
    setArchiveError(null);
    startArchive(async () => {
      const response = await archiveBrandAction(organizationId, brand.id);
      if (!response.success) {
        setArchiveError(response.error.message);
        return;
      }
      router.refresh();
    });
  };

  const closeForm = (): void => setFormMode(null);

  const handleFormSuccess = (): void => {
    setFormMode(null);
    router.refresh();
  };

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Brands"
        description="Manage the brands in your product catalog"
        icon={Tag}
      >
        {canManage && !formMode && (
          <Button type="button" onClick={() => setFormMode({ kind: "create" })}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Add brand
          </Button>
        )}
      </PageHeader>

      {archiveError && (
        <p
          role="alert"
          className="text-error-700 bg-error-50 border-error-200 mt-4 rounded-lg border px-3 py-2.5 text-sm"
        >
          {archiveError}
        </p>
      )}

      {formMode && (
        <div className="mt-6">
          <BrandForm
            organizationId={organizationId}
            brand={formMode.kind === "edit" ? formMode.brand : undefined}
            onSuccess={handleFormSuccess}
            onCancel={closeForm}
          />
        </div>
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
            aria-label="Search brands"
            placeholder="Search by name or description"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </form>
        <select
          aria-label="Filter by status"
          value={filters.status ?? ""}
          onChange={handleStatusChange}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            icon={Tag}
            title="No brands found"
            description={
              filters.search || filters.status
                ? "No brands match your current filters. Try adjusting your search."
                : "Add your first brand to start organizing your product catalog."
            }
            action={
              canManage
                ? {
                    label: "Add brand",
                    icon: Plus,
                    onClick: () => setFormMode({ kind: "create" }),
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
                      Name
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Description
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                    {canManage && (
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-medium"
                      >
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((brand: Brand) => (
                    <tr key={brand.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {brand.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {brand.description ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[brand.status]}>
                          {STATUS_LABEL[brand.status]}
                        </Badge>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setFormMode({ kind: "edit", brand })
                              }
                            >
                              <Pencil
                                className="mr-1 h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              Edit
                            </Button>
                            {brand.status !== "archived" && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isArchiving}
                                onClick={() => handleArchive(brand)}
                              >
                                <Archive
                                  className="mr-1 h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                Archive
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
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
            {total} {total === 1 ? "brand" : "brands"} · Page {page} of{" "}
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
