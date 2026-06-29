"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShieldCheck, AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { BusinessProfileCard } from "@/features/cbn/components/BusinessProfileCard";
import { ConnectionRequestDialog } from "@/features/cbn/components/ConnectionRequestDialog";
import { useBusinessDiscovery } from "@/features/cbn/hooks/useBusinessDiscovery";
import type { BusinessSearchResult } from "@/features/cbn/types/cbn.types";

interface BusinessDiscoveryProps {
  readonly organizationId: string;
}

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Full business discovery UI with search, filters, and grid of results.
 * Connects businesses via ConnectionRequestDialog.
 */
export function BusinessDiscovery({ organizationId }: BusinessDiscoveryProps) {
  const [searchInput, setSearchInput] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [dialogTarget, setDialogTarget] = useState<BusinessSearchResult | null>(null);

  const debouncedQuery = useDebounce(searchInput, 350);

  const { data: results = [], isLoading, isError } = useBusinessDiscovery({
    query: debouncedQuery,
  });

  const filtered = verifiedOnly
    ? results.filter((b) => b.verificationLevel >= 3)
    : results;

  const handleConnect = useCallback(
    (orgId: string): void => {
      const business = results.find((b) => b.id === orgId);
      if (business) {setDialogTarget(business);}
    },
    [results]
  );

  const handleDialogClose = useCallback((): void => {
    setDialogTarget(null);
  }, []);

  return (
    <div className="space-y-5">
      {/* Search bar + filter */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by business name, GST, or Business ID…"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            aria-label="Search businesses"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 dark:border-slate-700"
          />
          <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden="true" />
          Verified only
        </label>
      </div>

      {/* Results */}
      <div role="status" aria-live="polite" aria-label="Search results">
        {isLoading && debouncedQuery.length >= 2 && (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" label="Searching businesses…" />
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            Failed to search businesses. Please try again.
          </div>
        )}

        {!isLoading && !isError && debouncedQuery.length >= 2 && filtered.length === 0 && (
          <EmptyState
            icon={Search}
            title="No businesses found"
            description={
              verifiedOnly
                ? "No verified businesses match your search. Try removing the verified filter."
                : "No businesses match your search. Try a different name, GST number, or Business ID."
            }
          />
        )}

        {!isLoading && debouncedQuery.length < 2 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-500/20">
              <Search className="h-7 w-7 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Search the Business Network
            </h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Enter at least 2 characters to search for businesses by name,
              GST number, or Syncrate Business ID (SYN-XX-XXXXXX).
            </p>
          </div>
        )}

        <AnimatePresence>
          {!isLoading && filtered.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filtered.map((business) => (
                <BusinessProfileCard
                  key={business.id}
                  business={business}
                  onConnect={handleConnect}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Connection request dialog */}
      {dialogTarget && (
        <ConnectionRequestDialog
          recipientOrgId={dialogTarget.id}
          recipientName={dialogTarget.displayName ?? dialogTarget.name}
          requesterOrgId={organizationId}
          open={dialogTarget !== null}
          onClose={handleDialogClose}
        />
      )}
    </div>
  );
}
