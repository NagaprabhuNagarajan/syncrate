"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Lightbulb, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { generateRecommendationsAction } from "../actions/recommendation.actions";
import type {
  RecommendationCategory,
  RecommendationItem,
  RecommendationOutput,
} from "../schemas/recommendation.schema";

const CATEGORY_LABELS: Record<RecommendationCategory, string> = {
  reorder: "Reorder",
  best_supplier: "Best supplier",
  customer_followup: "Customer follow-up",
  discount: "Discount",
  inventory_optimization: "Inventory optimization",
  cross_sell: "Cross-sell",
  upsell: "Upsell",
};

type PriorityVariant = "destructive" | "warning" | "muted";

const PRIORITY_VARIANT: Record<
  RecommendationItem["priority"],
  PriorityVariant
> = {
  high: "destructive",
  medium: "warning",
  low: "muted",
};

function confidenceLabel(confidence: number): string {
  return `${Math.round(confidence * 100)}% confidence`;
}

function confidenceVariant(confidence: number): "success" | "info" | "muted" {
  if (confidence >= 0.75) {
    return "success";
  }
  if (confidence >= 0.5) {
    return "info";
  }
  return "muted";
}

interface RecommendationCardProps {
  readonly item: RecommendationItem;
  readonly index: number;
}

function RecommendationCard({ item, index }: RecommendationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
    >
      <Card className="h-full">
        <CardHeader className="space-y-2 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{CATEGORY_LABELS[item.category]}</Badge>
            <StatusBadge
              variant={PRIORITY_VARIANT[item.priority]}
              label={`${item.priority} priority`}
            />
            <Badge variant={confidenceVariant(item.confidence)}>
              {confidenceLabel(item.confidence)}
            </Badge>
          </div>
          <h3 className="text-base font-semibold text-foreground">
            {item.title}
          </h3>
          {item.entityRef !== null && (
            <p className="text-xs text-muted-foreground">{item.entityRef}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{item.reason}</p>
          {item.supportingData.length > 0 && (
            <dl className="grid grid-cols-2 gap-2">
              {item.supportingData.map((datum) => (
                <div
                  key={`${datum.label}-${datum.value}`}
                  className="rounded-lg border bg-muted/30 px-3 py-2"
                >
                  <dt className="text-xs text-muted-foreground">
                    {datum.label}
                  </dt>
                  <dd className="nums text-sm font-medium text-foreground">
                    {datum.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface RecommendationsViewProps {
  readonly organizationId: string;
  readonly canGenerate: boolean;
}

export function RecommendationsView({
  organizationId,
  canGenerate,
}: RecommendationsViewProps) {
  const [data, setData] = useState<RecommendationOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await generateRecommendationsAction(organizationId);
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error.message);
      }
    } catch {
      setError("Something went wrong while generating recommendations.");
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  const onGenerateClick = useCallback(() => {
    void handleGenerate();
  }, [handleGenerate]);

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <PageHeader
        title="AI Recommendations"
        description="Actionable suggestions grounded in your live business data"
        icon={Sparkles}
      >
        {canGenerate && (
          <Button variant="gradient" onClick={onGenerateClick} loading={isLoading}>
            <Sparkles className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {data ? "Regenerate" : "Generate"}
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
          icon={Lightbulb}
          title="No recommendations yet"
          description={
            canGenerate
              ? "Generate AI recommendations from your current products, inventory, suppliers, customers and sales."
              : "You do not have permission to generate AI recommendations."
          }
          action={
            canGenerate
              ? { label: "Generate recommendations", onClick: onGenerateClick }
              : undefined
          }
        />
      ) : data.recommendations.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="Nothing to recommend right now"
          description={data.summary}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.recommendations.map((item, index) => (
            <RecommendationCard
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
