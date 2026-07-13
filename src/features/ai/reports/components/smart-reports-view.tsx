"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  FileBarChart,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Lightbulb,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorBanner } from "@/components/shared/error-banner";
import { runSmartReportAction } from "@/features/ai/reports/actions/report.actions";
import { REPORT_TYPES } from "@/features/ai/reports/schemas/reportSchema";
import type {
  ReportSection,
  ReportTrend,
  ReportType,
} from "@/features/ai/reports/schemas/reportSchema";
import type { SmartReport } from "@/features/ai/reports/types/report.types";

const REPORT_LABELS: Record<ReportType, string> = {
  business_health: "Business health",
  profit_analysis: "Profit analysis",
  inventory_summary: "Inventory summary",
  cash_flow: "Cash-flow insights",
  customer_analysis: "Customer analysis",
  supplier_performance: "Supplier performance",
};

const TREND_ICON: Record<ReportTrend, LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
  mixed: Activity,
};

function trendBadgeVariant(
  trend: ReportTrend
): "success" | "destructive" | "muted" | "info" {
  switch (trend) {
    case "up":
      return "success";
    case "down":
      return "destructive";
    case "mixed":
      return "info";
    default:
      return "muted";
  }
}

interface SmartReportsViewProps {
  readonly organizationId: string;
  readonly canGenerate: boolean;
}

function SectionCard({ section }: { readonly section: ReportSection }) {
  const TrendIcon = TREND_ICON[section.trend];
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {section.title}
          </h3>
          <Badge dot variant={trendBadgeVariant(section.trend)}>
            <TrendIcon className="mr-1 h-3 w-3" aria-hidden="true" />
            {section.trend}
          </Badge>
        </div>

        <p className="text-sm text-slate-700 dark:text-slate-300">{section.narrative}</p>

        {section.metrics.length > 0 && (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {section.metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"
              >
                <dt className="text-xs text-slate-500 dark:text-slate-400">{metric.label}</dt>
                <dd className="nums mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {metric.value}
                  {metric.changePercent !== null && (
                    <span
                      className={
                        metric.changePercent >= 0
                          ? "ml-1.5 text-xs font-medium text-success"
                          : "ml-1.5 text-xs font-medium text-destructive"
                      }
                    >
                      {metric.changePercent >= 0 ? "+" : ""}
                      {metric.changePercent}%
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {section.recommendations.length > 0 && (
          <div className="rounded-lg border border-primary-100 bg-primary-50 p-3 dark:border-primary-500/20 dark:bg-primary-500/10">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-primary-700 dark:text-primary-300">
              <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
              Recommendations
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-700 dark:text-slate-300">
              {section.recommendations.map((rec) => (
                <li key={rec}>{rec}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-slate-400 dark:text-slate-500">
          {Math.round(section.confidence * 100)}% confidence · {section.explanation}
        </p>
      </CardContent>
    </Card>
  );
}
SectionCard.displayName = "SectionCard";

export function SmartReportsView({
  organizationId,
  canGenerate,
}: SmartReportsViewProps) {
  const [reportType, setReportType] = useState<ReportType>("business_health");
  const [report, setReport] = useState<SmartReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleGenerate = (): void => {
    if (!canGenerate) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const response = await runSmartReportAction(organizationId, reportType);
      if (!response.success) {
        setReport(null);
        setError(response.error.message);
        return;
      }
      setReport(response.data);
    });
  };

  const handleTypeChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    setReportType(event.target.value as ReportType);
  };

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Smart Reports"
        description="AI-generated, explainable reports across sales, cash, inventory and partners"
        icon={FileBarChart}
      />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          aria-label="Report type"
          value={reportType}
          onChange={handleTypeChange}
          disabled={!canGenerate || isPending}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-[border-color,box-shadow] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
        >
          {REPORT_TYPES.map((type) => (
            <option key={type} value={type}>
              {REPORT_LABELS[type]}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="gradient"
          onClick={handleGenerate}
          loading={isPending}
          disabled={!canGenerate}
        >
          Generate report
        </Button>
      </div>

      {!canGenerate && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning-dark"
        >
          You do not have permission to generate AI reports.
        </p>
      )}

      {error && <ErrorBanner message={error} className="mt-4" />}

      {!report && !error && !isPending && (
        <div className="mt-4">
          <EmptyState
            icon={FileBarChart}
            title="No report yet"
            description="Choose a report type and generate an AI analysis of your business data."
          />
        </div>
      )}

      {report && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mt-4 space-y-4"
        >
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {report.title}
              </h2>
              <Badge variant="muted">
                {Math.round(report.confidence * 100)}% confidence
              </Badge>
            </div>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{report.summary}</p>
          </div>

          {report.sections.map((section) => (
            <SectionCard key={section.title} section={section} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
SmartReportsView.displayName = "SmartReportsView";
