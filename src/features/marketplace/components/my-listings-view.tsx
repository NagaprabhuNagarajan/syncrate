"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Archive,
  Eye,
  EyeOff,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Store,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ListingForm } from "@/features/marketplace/components/listing-form";
import {
  archiveListingAction,
  setListingPublishedAction,
  setListingStatusAction,
} from "@/features/marketplace/actions/marketplace.actions";
import type {
  ListingStatus,
  ListingType,
  MarketplaceListing,
  MarketplaceListingListResult,
} from "@/features/marketplace/types/marketplace.types";

// ─────────────────────────────────────────────────────────────
// Presentation maps
// ─────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<ListingStatus, BadgeProps["variant"]> = {
  active: "success",
  paused: "warning",
  archived: "secondary",
};

const STATUS_LABEL: Record<ListingStatus, string> = {
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

const TYPE_LABEL: Record<ListingType, string> = {
  product: "Product",
  supplier: "Supplier",
};

const STATUS_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
];

const TYPE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "", label: "All types" },
  { value: "product", label: "Product" },
  { value: "supplier", label: "Supplier" },
];

function formatPrice(listing: MarketplaceListing): string {
  if (listing.price === null) {
    return "On request";
  }
  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: listing.currency || "INR",
    maximumFractionDigits: 2,
  }).format(listing.price);
  return listing.unit ? `${formatted} / ${listing.unit}` : formatted;
}

// ─────────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────────

interface ListingRowProps {
  readonly organizationId: string;
  readonly listing: MarketplaceListing;
  readonly canManage: boolean;
  readonly onEdit: (listing: MarketplaceListing) => void;
}

function ListingRow({
  organizationId,
  listing,
  canManage,
  onEdit,
}: ListingRowProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = useCallback(
    (mutation: () => Promise<{ success: boolean; error?: { message: string } }>) => {
      setError(null);
      startTransition(async () => {
        const response = await mutation();
        if (!response.success) {
          setError(response.error?.message ?? "Action failed");
          return;
        }
        router.refresh();
      });
    },
    [router]
  );

  const handleEdit = useCallback(() => {
    onEdit(listing);
  }, [listing, onEdit]);

  const handleTogglePublish = useCallback(() => {
    run(() =>
      setListingPublishedAction(organizationId, listing.id, !listing.isPublished)
    );
  }, [organizationId, listing.id, listing.isPublished, run]);

  const handlePauseResume = useCallback(() => {
    const next: ListingStatus =
      listing.status === "active" ? "paused" : "active";
    run(() => setListingStatusAction(organizationId, listing.id, next));
  }, [organizationId, listing.id, listing.status, run]);

  const handleArchive = useCallback(() => {
    run(() => archiveListingAction(organizationId, listing.id));
  }, [organizationId, listing.id, run]);

  const archived = listing.status === "archived";

  return (
    <tr className="align-top transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-900 dark:text-slate-100">{listing.title}</div>
        {listing.category && (
          <div className="text-xs text-slate-500 dark:text-slate-400">{listing.category}</div>
        )}
        {error && (
          <div role="alert" className="mt-1 text-xs text-error">
            {error}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge variant="info">{TYPE_LABEL[listing.listingType]}</Badge>
      </td>
      <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">
        {formatPrice(listing)}
      </td>
      <td className="px-4 py-3">
        <Badge variant={listing.isPublished ? "success" : "muted"}>
          {listing.isPublished ? "Published" : "Hidden"}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <Badge variant={STATUS_VARIANT[listing.status]}>
          {STATUS_LABEL[listing.status]}
        </Badge>
      </td>
      <td className="px-4 py-3">
        {canManage && !archived && (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleEdit}
              disabled={isPending}
              aria-label={`Edit ${listing.title}`}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTogglePublish}
              loading={isPending}
              aria-label={
                listing.isPublished
                  ? `Unpublish ${listing.title}`
                  : `Publish ${listing.title}`
              }
            >
              {listing.isPublished ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePauseResume}
              disabled={isPending}
              aria-label={
                listing.status === "active"
                  ? `Pause ${listing.title}`
                  : `Activate ${listing.title}`
              }
            >
              {listing.status === "active" ? (
                <Pause className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleArchive}
              disabled={isPending}
              aria-label={`Archive ${listing.title}`}
            >
              <Archive className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────
// View
// ─────────────────────────────────────────────────────────────

interface MyListingsViewProps {
  readonly organizationId: string;
  readonly result: MarketplaceListingListResult;
  readonly filters: {
    readonly search?: string;
    readonly status?: ListingStatus;
    readonly listingType?: ListingType;
  };
  readonly canManage: boolean;
}

export function MyListingsView({
  organizationId,
  result,
  filters,
  canManage,
}: MyListingsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MarketplaceListing | null>(null);

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
        query ? `/marketplace/my-listings?${query}` : "/marketplace/my-listings"
      );
    },
    [router, searchParams]
  );

  const handleSearchSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      pushWith({ search: searchInput.trim() || undefined, page: undefined });
    },
    [pushWith, searchInput]
  );

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      setSearchInput(event.target.value);
    },
    []
  );

  const handleStatusChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>): void => {
      pushWith({ status: event.target.value || undefined, page: undefined });
    },
    [pushWith]
  );

  const handleTypeChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>): void => {
      pushWith({ type: event.target.value || undefined, page: undefined });
    },
    [pushWith]
  );

  const openCreate = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((listing: MarketplaceListing) => {
    setEditing(listing);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditing(null);
  }, []);

  const handleSaved = useCallback(() => {
    setFormOpen(false);
    setEditing(null);
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
        title="My listings"
        description="Create and manage your marketplace listings"
        icon={Store}
      >
        {canManage && (
          <Button type="button" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Add listing
          </Button>
        )}
      </PageHeader>

      {formOpen && canManage && (
        <div className="mt-6">
          <ListingForm
            organizationId={organizationId}
            listing={editing ?? undefined}
            onSaved={handleSaved}
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
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search listings"
            placeholder="Search by title, description or category"
            value={searchInput}
            onChange={handleSearchChange}
            className="focus:border-primary-500 focus:ring-primary-500 block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors hover:border-slate-400 focus:outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 dark:hover:border-slate-600"
          />
        </form>
        <select
          aria-label="Filter by type"
          value={filters.listingType ?? ""}
          onChange={handleTypeChange}
          className="focus:border-primary-500 focus:ring-primary-500 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors hover:border-slate-400 focus:outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600"
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value || "all-types"} value={option.value}>
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
            icon={Store}
            title="No listings yet"
            description={
              filters.search || filters.status || filters.listingType
                ? "No listings match your current filters. Try adjusting your search."
                : "Create your first listing to start selling on the marketplace."
            }
            action={
              canManage
                ? { label: "Add listing", icon: Plus, onClick: openCreate }
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
                      Listing
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Type
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Price
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Visibility
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-medium"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((listing) => (
                    <ListingRow
                      key={listing.id}
                      organizationId={organizationId}
                      listing={listing}
                      canManage={canManage}
                      onEdit={openEdit}
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
            {total} {total === 1 ? "listing" : "listings"} · Page {page} of{" "}
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
