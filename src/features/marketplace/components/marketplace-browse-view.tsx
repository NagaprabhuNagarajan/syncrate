"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Star, Store, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import type {
  ListingType,
  MarketplaceBrowseListing,
  MarketplaceBrowseResult,
} from "@/features/marketplace/types/marketplace.types";

const TYPE_LABEL: Record<ListingType, string> = {
  product: "Product",
  supplier: "Supplier",
};

const TYPE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "", label: "All types" },
  { value: "product", label: "Products" },
  { value: "supplier", label: "Suppliers" },
];

function formatPrice(listing: MarketplaceBrowseListing): string {
  if (listing.price === null) {
    return "Quote on request";
  }
  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: listing.currency || "INR",
    maximumFractionDigits: 2,
  }).format(listing.price);
  return listing.unit ? `${formatted} / ${listing.unit}` : formatted;
}

// ─────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────

interface ListingCardProps {
  readonly listing: MarketplaceBrowseListing;
}

function ListingCard({ listing }: ListingCardProps) {
  const rating = listing.reputation;
  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="info">{TYPE_LABEL[listing.listingType]}</Badge>
          {rating && rating.reviewCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-slate-600">
              <Star
                className="h-3.5 w-3.5 fill-warning text-warning"
                aria-hidden="true"
              />
              {rating.averageRating.toFixed(1)}
              <span className="text-slate-400">({rating.reviewCount})</span>
            </span>
          )}
        </div>

        <div>
          <h3 className="line-clamp-2 text-base font-semibold text-slate-900">
            {listing.title}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
            <Store className="h-3.5 w-3.5" aria-hidden="true" />
            {listing.sellerName}
          </p>
        </div>

        {listing.description && (
          <p className="line-clamp-3 text-sm text-slate-600">
            {listing.description}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="text-primary-600 font-semibold tabular-nums">
            {formatPrice(listing)}
          </div>
          {listing.category && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Tag className="h-3 w-3" aria-hidden="true" />
              {listing.category}
            </span>
          )}
        </div>
        {listing.minOrderQty !== null && (
          <p className="text-xs text-slate-400">
            Min. order: {listing.minOrderQty}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// View
// ─────────────────────────────────────────────────────────────

interface MarketplaceBrowseViewProps {
  readonly result: MarketplaceBrowseResult;
  readonly filters: {
    readonly query?: string;
    readonly listingType?: ListingType;
    readonly category?: string;
  };
}

export function MarketplaceBrowseView({
  result,
  filters,
}: MarketplaceBrowseViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [queryInput, setQueryInput] = useState(filters.query ?? "");

  const { items, page, hasMore } = result;

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
      router.push(query ? `/marketplace?${query}` : "/marketplace");
    },
    [router, searchParams]
  );

  const handleSearchSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      pushWith({ q: queryInput.trim() || undefined, page: undefined });
    },
    [pushWith, queryInput]
  );

  const handleQueryChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      setQueryInput(event.target.value);
    },
    []
  );

  const handleTypeChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>): void => {
      pushWith({ type: event.target.value || undefined, page: undefined });
    },
    [pushWith]
  );

  const goPrev = useCallback(() => {
    pushWith({ page: page - 1 <= 1 ? undefined : String(page - 1) });
  }, [page, pushWith]);

  const goNext = useCallback(() => {
    pushWith({ page: String(page + 1) });
  }, [page, pushWith]);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Marketplace"
        description="Discover products and suppliers across the network"
        icon={Store}
      />

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
            aria-label="Search marketplace"
            placeholder="Search products and suppliers"
            value={queryInput}
            onChange={handleQueryChange}
            className="focus:border-primary-500 focus:ring-primary-500 block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors hover:border-slate-400 focus:outline-none focus:ring-2"
          />
        </form>
        <select
          aria-label="Filter by type"
          value={filters.listingType ?? ""}
          onChange={handleTypeChange}
          className="focus:border-primary-500 focus:ring-primary-500 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors hover:border-slate-400 focus:outline-none focus:ring-2"
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value || "all-types"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Grid / empty state */}
      <div className="mt-6">
        {items.length === 0 ? (
          <EmptyState
            icon={Store}
            title="No listings found"
            description={
              filters.query || filters.listingType || filters.category
                ? "No listings match your search. Try different keywords or filters."
                : "There are no marketplace listings to show right now. Check back soon."
            }
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {items.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </motion.div>
        )}
      </div>

      {/* Pagination */}
      {items.length > 0 && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">Page {page}</p>
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
              disabled={!hasMore}
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
