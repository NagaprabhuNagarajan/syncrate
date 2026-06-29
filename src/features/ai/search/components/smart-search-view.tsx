"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Search, Sparkles, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { runSmartSearchAction } from "@/features/ai/search/actions/search.actions";
import type {
  SearchResultGroup,
  SmartSearchResult,
} from "@/features/ai/search/types/search.types";

const EXAMPLE_QUERIES: readonly string[] = [
  "show unpaid invoices",
  "products below reorder level",
  "customers with overdue payments",
  "active suppliers",
];

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatAmount(value: number): string {
  return currencyFormatter.format(value);
}

interface SmartSearchViewProps {
  readonly organizationId: string;
  readonly canGenerate: boolean;
}

function ResultGroup({ group }: { readonly group: SearchResultGroup }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{group.label}</h3>
          <Badge variant="muted">
            {group.total} {group.total === 1 ? "result" : "results"}
          </Badge>
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {group.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {item.title}
                </p>
                {item.subtitle && (
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {item.subtitle}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {item.meta && (
                  <Badge variant="secondary" className="capitalize">
                    {item.meta}
                  </Badge>
                )}
                {item.amount !== null && (
                  <span className="nums text-sm text-slate-700 dark:text-slate-300">
                    {formatAmount(item.amount)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
ResultGroup.displayName = "ResultGroup";

export function SmartSearchView({
  organizationId,
  canGenerate,
}: SmartSearchViewProps) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SmartSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const runSearch = (raw: string): void => {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || !canGenerate) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const response = await runSmartSearchAction(organizationId, trimmed);
      if (!response.success) {
        setResult(null);
        setError(response.error.message);
        return;
      }
      setResult(response.data);
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    runSearch(query);
  };

  const handleExample = (example: string): void => {
    setQuery(example);
    runSearch(example);
  };

  const hasResults =
    result !== null && result.groups.some((g) => g.items.length > 0);

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Smart Search"
        description="Ask in plain language — AI turns it into a precise query over your data"
        icon={Sparkles}
      />

      <form onSubmit={handleSubmit} role="search" className="mt-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Smart search query"
            placeholder="e.g. show unpaid invoices"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={!canGenerate}
            className="pl-9 pr-28"
          />
          <Button
            type="submit"
            variant="gradient"
            size="sm"
            loading={isPending}
            disabled={!canGenerate || query.trim().length === 0}
            className="absolute right-1.5 top-1/2 -translate-y-1/2"
          >
            Search
          </Button>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">Try:</span>
        {EXAMPLE_QUERIES.map((example) => (
          <Button
            key={example}
            type="button"
            variant="outline"
            size="sm"
            disabled={!canGenerate || isPending}
            onClick={() => handleExample(example)}
          >
            {example}
          </Button>
        ))}
      </div>

      {!canGenerate && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning-dark"
        >
          You do not have permission to run AI searches.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="text-error-700 bg-error-50 border-error-200 mt-4 rounded-lg border px-3 py-2.5 text-sm dark:text-error-300 dark:bg-error-500/10 dark:border-error-500/30"
        >
          {error}
        </p>
      )}

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-4 space-y-4"
        >
          <div className="flex items-start gap-2 rounded-lg border border-primary-100 bg-primary-50 px-3 py-2.5 dark:border-primary-500/20 dark:bg-primary-500/10">
            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-primary-600"
              aria-hidden="true"
            />
            <p className="text-sm text-slate-700 dark:text-slate-300">
              <span className="font-medium text-slate-900 dark:text-slate-100">
                Interpreted as:
              </span>{" "}
              {result.intent.explanation}{" "}
              <span className="text-slate-500 dark:text-slate-400">
                ({Math.round(result.intent.confidence * 100)}% confidence)
              </span>
            </p>
          </div>

          {hasResults ? (
            result.groups
              .filter((g) => g.items.length > 0)
              .map((g) => <ResultGroup key={g.entity} group={g} />)
          ) : (
            <EmptyState
              icon={Search}
              title="No matches found"
              description="No records matched your query. Try rephrasing or broadening it."
            />
          )}
        </motion.div>
      )}
    </div>
  );
}
SmartSearchView.displayName = "SmartSearchView";
