"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  FolderTree,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Archive,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorBanner } from "@/components/shared/error-banner";
import { CategoryForm } from "@/features/category/components/category-form";
import { archiveCategoryAction } from "@/features/category/actions/category.actions";
import type {
  Category,
  CategoryListResult,
  CategoryStatus,
} from "@/features/category/types/category.types";

// ─────────────────────────────────────────────────────────────
// Status presentation
// ─────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<CategoryStatus, BadgeProps["variant"]> = {
  active: "success",
  archived: "secondary",
};

const STATUS_LABEL: Record<CategoryStatus, string> = {
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

interface CategoriesViewProps {
  readonly organizationId: string;
  readonly result: CategoryListResult;
  readonly allCategories: readonly Category[];
  readonly filters: {
    readonly search?: string;
    readonly status?: CategoryStatus;
  };
  readonly canManage: boolean;
}

type FormState =
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly category: Category }
  | null;

export function CategoriesView({
  organizationId,
  result,
  allCategories,
  filters,
  canManage,
}: CategoriesViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [formState, setFormState] = useState<FormState>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isArchiving, startArchive] = useTransition();

  const { items, total, page, pageSize } = result;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const parentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of allCategories) {
      map.set(category.id, category.name);
    }
    return map;
  }, [allCategories]);

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
    router.push(query ? `/products/categories?${query}` : "/products/categories");
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

  const handleFormSuccess = (): void => {
    setFormState(null);
    router.refresh();
  };

  const handleArchive = (categoryId: string): void => {
    setArchiveError(null);
    startArchive(async () => {
      const response = await archiveCategoryAction(organizationId, categoryId);
      if (!response.success) {
        setArchiveError(response.error.message);
        return;
      }
      router.refresh();
    });
  };

  const parentLabel = (parentId: string | null): string => {
    if (!parentId) {
      return "—";
    }
    return parentNameById.get(parentId) ?? "—";
  };

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Categories"
        description="Organize your products into nested categories"
        icon={FolderTree}
      >
        {canManage && (
          <Button
            type="button"
            variant="gradient"
            onClick={() => setFormState({ mode: "create" })}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Add category
          </Button>
        )}
      </PageHeader>

      {archiveError && <ErrorBanner message={archiveError} className="mt-4" />}

      {canManage && formState && (
        <div className="mt-4">
          <CategoryForm
            organizationId={organizationId}
            category={formState.mode === "edit" ? formState.category : undefined}
            allCategories={allCategories}
            onSuccess={handleFormSuccess}
            onCancel={() => setFormState(null)}
          />
        </div>
      )}

      {/* Filters */}
      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <form
          onSubmit={handleSearchSubmit}
          role="search"
          className="relative flex-1"
        >
          <Search
            className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Search categories"
            placeholder="Search by name or description"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </form>
        <select
          aria-label="Filter by status"
          value={filters.status ?? ""}
          onChange={handleStatusChange}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-[border-color,box-shadow] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table / empty state */}
      <div className="mt-4">
        {items.length === 0 ? (
          <EmptyState
            icon={FolderTree}
            title="No categories found"
            description={
              filters.search || filters.status
                ? "No categories match your current filters. Try adjusting your search."
                : "Add your first category to start organizing your products."
            }
            action={
              canManage
                ? {
                    label: "Add category",
                    icon: Plus,
                    onClick: () => setFormState({ mode: "create" }),
                  }
                : undefined
            }
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Name
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Parent
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Description
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Status
                    </th>
                    {canManage && (
                      <th
                        scope="col"
                        className="px-3 py-2 text-right font-medium"
                      >
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((category: Category) => (
                    <tr key={category.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                        {category.name}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                        {parentLabel(category.parentId)}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                        {category.description ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge dot variant={STATUS_VARIANT[category.status]}>
                          {STATUS_LABEL[category.status]}
                        </Badge>
                      </td>
                      {canManage && (
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setFormState({ mode: "edit", category })
                              }
                            >
                              <Pencil
                                className="mr-1 h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isArchiving}
                              onClick={() => handleArchive(category.id)}
                            >
                              <Archive
                                className="mr-1 h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              Archive
                            </Button>
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
            {total} {total === 1 ? "category" : "categories"} · Page {page} of{" "}
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
