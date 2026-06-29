"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { generateInsightsAction } from "../actions/insight.actions";
import type {
  InsightCategory,
  InsightItem,
  InsightOutput,
  InsightSeverity,
  InsightTrend,
} from "../schemas/insight.schema";

const CATEGORY_LABELS: Record<InsightCategory, string> = {
  revenue_growth: "Revenue growth",
  declining_sales: "Declining sales",
  slow_moving_inventory: "Slow-moving inventory",
  customer_churn_risk: "Customer churn risk",
  supplier_performance: "Supplier performance",
  profitability_trend: "Profitability trend",
};

type SeverityVariant = "success" | "info" | "warning" | "destructive";

const SEVERITY_VARIANT: Record<InsightSeverity, SeverityVariant> = {
  positive: "success",
  info: "info",
  warning: "warning",
  critical: "destructive",
};

const TREND_ICON = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
} as const;

const TREND_COLOR: Record<InsightTrend, string> = {
  up: "text-success",
  down: "text-error",
  flat: "text-muted-foreground",
};

function confidenceLabel(confidence: number): string {
  return `${Math.round(confidence * 100)}% confidence`;
}

function formatChange(change: number | null): string | null {
  if (change === null) {
    return null;
  }
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

interface InsightCardProps {
  readonly item: InsightItem;
  readonly index: number;
}

function InsightCard({ item, index }: InsightCardProps) {
  const TrendIcon = TREND_ICON[item.trend];
  const change = formatChange(item.metric.changePercent);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
    >
      <Card className="h-full">
        <CardHeader className="space-y-2 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={SEVERITY_VARIANT[item.severity]}>
              {CATEGORY_LABELS[item.category]}
            </Badge>
            <Badge variant="muted">{confidenceLabel(item.confidence)}</Badge>
          </div>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-foreground">
              {item.title}
            </h3>
            <TrendIcon
              className={`h-5 w-5 shrink-0 ${TREND_COLOR[item.trend]}`}
              aria-hidden="true"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">{item.metric.label}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold tabular-nums text-foreground">
                {item.metric.value}
              </span>
              {change !== null && (
                <span className={`text-sm font-medium ${TREND_COLOR[item.trend]}`}>
                  {change}
                </span>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{item.explanation}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface InsightsViewProps {
  readonly organizationId: string;
  readonly canGenerate: boolean;
}

export function InsightsView({
  organizationId,
  canGenerate,
}: InsightsViewProps) {
  const [data, setData] = useState<InsightOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await generateInsightsAction(organizationId);
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error.message);
      }
    } catch {
      setError("Something went wrong while generating insights.");
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  const onGenerateClick = useCallback(() => {
    void handleGenerate();
  }, [handleGenerate]);

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <PageHeader
        title="AI Insights"
        description="Continuously-analyzed intelligence about your business health"
        icon={BarChart3}
      >
        {canGenerate && (
          <Button onClick={onGenerateClick} loading={isLoading}>
            <BarChart3 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {data ? "Refresh insights" : "Analyze"}
          </Button>
        )}
      </PageHeader>

      {data?.summary && !isLoading && error === null && (
        <p className="text-sm text-muted-foreground">{data.summary}</p>
      )}

      {isLoading ? (
        <div className="py-16">
          <LoadingSpinner label="Analyzing your business…" />
        </div>
      ) : error !== null ? (
        <ErrorState message={error} onRetry={onGenerateClick} />
      ) : data === null ? (
        <EmptyState
          icon={BarChart3}
          title="No insights yet"
          description={
            canGenerate
              ? "Analyze your sales, inventory, customers and suppliers to surface trends, risks and opportunities."
              : "You do not have permission to generate AI insights."
          }
          action={
            canGenerate
              ? { label: "Analyze business", onClick: onGenerateClick }
              : undefined
          }
        />
      ) : data.insights.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No insights to show yet"
          description={data.summary}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.insights.map((item, index) => (
            <InsightCard
              key={`${item.category}-${item.title}`}
              item={item}
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  );
}
