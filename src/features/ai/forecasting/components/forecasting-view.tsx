"use client";

import { useCallback } from "react";
import { motion } from "framer-motion";
import { LineChart, Sparkles, TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { useForecast } from "@/features/ai/forecasting/hooks/useForecast";
import type {
  ForecastResult,
  ForecastType,
  ForecastTypeOption,
} from "@/features/ai/forecasting/types/forecast.types";

const FORECAST_TYPE_OPTIONS: readonly ForecastTypeOption[] = [
  {
    value: "sales",
    label: "Sales",
    description: "Projected gross invoiced sales",
  },
  {
    value: "revenue",
    label: "Revenue",
    description: "Projected collections from customers",
  },
  {
    value: "cash_flow",
    label: "Cash Flow",
    description: "Net of collections and supplier payments",
  },
  {
    value: "purchase",
    label: "Purchasing",
    description: "Projected purchasing spend",
  },
  {
    value: "inventory",
    label: "Inventory",
    description: "Projected net stock movement",
  },
  {
    value: "seasonal_demand",
    label: "Seasonal Demand",
    description: "Demand pattern across the year",
  },
] as const;

const SKELETON_KEYS = ["sk-1", "sk-2", "sk-3", "sk-4", "sk-5"] as const;

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

function fmtNumber(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(value);
}

function confidenceVariant(
  confidence: number
): "success" | "warning" | "destructive" {
  if (confidence >= 0.7) {
    return "success";
  }
  if (confidence >= 0.4) {
    return "warning";
  }
  return "destructive";
}

// ── forecast type selector button (no inline arrows in render) ──────

interface ForecastTypeButtonProps {
  readonly option: ForecastTypeOption;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly onSelect: (value: ForecastType) => void;
}

function ForecastTypeButton({
  option,
  selected,
  disabled,
  onSelect,
}: ForecastTypeButtonProps) {
  const handleClick = useCallback(() => {
    onSelect(option.value);
  }, [onSelect, option.value]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex flex-col items-start gap-0.5 rounded-lg border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-input hover:bg-accent"
      }`}
    >
      <span className="text-sm font-medium text-foreground">
        {option.label}
      </span>
      <span className="text-xs text-muted-foreground">
        {option.description}
      </span>
    </button>
  );
}

// ── forecast result panel ──────────────────────────────────────────

interface ForecastResultPanelProps {
  readonly forecast: ForecastResult;
}

function ForecastResultPanel({ forecast }: ForecastResultPanelProps) {
  const percent = Math.round(forecast.confidence * 100);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Outlook</CardTitle>
          <Badge
            dot
            variant={confidenceVariant(forecast.confidence)}
            aria-label={`Confidence ${percent} percent`}
          >
            {percent}% confidence
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-foreground">{forecast.summary}</p>
          {forecast.reason.length > 0 && (
            <p className="text-sm text-muted-foreground">{forecast.reason}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          {forecast.points.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              The model returned no forecast points.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table
                className="w-full text-sm"
                aria-label="Forecast by period"
              >
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase text-muted-foreground">
                    <th className="pb-2 pr-4">Period</th>
                    <th className="pb-2 pr-4 text-right">Predicted</th>
                    <th className="pb-2 pr-4 text-right">Low</th>
                    <th className="pb-2 text-right">High</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {forecast.points.map((point) => (
                    <tr key={point.period} className="transition-colors hover:bg-muted/40">
                      <td className="py-2.5 pr-4 font-medium">
                        {point.period}
                      </td>
                      <td className="nums py-2.5 pr-4 text-right font-medium">
                        {fmtNumber(point.predicted)}
                      </td>
                      <td className="nums py-2.5 pr-4 text-right text-muted-foreground">
                        {point.low === null ? "—" : fmtNumber(point.low)}
                      </td>
                      <td className="nums py-2.5 text-right text-muted-foreground">
                        {point.high === null ? "—" : fmtNumber(point.high)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Assumptions</CardTitle>
          </CardHeader>
          <CardContent>
            {forecast.assumptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No assumptions provided.
              </p>
            ) : (
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
                {forecast.assumptions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Key Drivers</CardTitle>
          </CardHeader>
          <CardContent>
            {forecast.drivers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No drivers provided.
              </p>
            ) : (
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
                {forecast.drivers.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ForecastSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {SKELETON_KEYS.map((key) => (
        <Skeleton key={key} className="h-10 w-full" />
      ))}
    </div>
  );
}

// ── main view ──────────────────────────────────────────────────────

interface ForecastingViewProps {
  readonly organizationId: string;
}

export function ForecastingView({ organizationId }: ForecastingViewProps) {
  const { forecast, isLoading, error, forecastType, run } = useForecast();

  const handleSelect = useCallback(
    (value: ForecastType) => {
      void run(organizationId, value);
    },
    [organizationId, run]
  );

  return (
    <motion.div
      className="space-y-4 p-4 lg:p-6"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-brand shadow-glow-primary">
          <TrendingUp
            className="h-5 w-5 text-white"
            aria-hidden="true"
          />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            AI Forecasting
          </h1>
          <p className="text-sm text-muted-foreground">
            Project sales, cash flow, demand and more from your business
            history.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Choose a forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FORECAST_TYPE_OPTIONS.map((option) => (
              <ForecastTypeButton
                key={option.value}
                option={option}
                selected={forecastType === option.value}
                disabled={isLoading}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {error !== null && (
        <ErrorState title="Could not generate forecast" message={error} />
      )}

      {isLoading ? (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Sparkles
              className="h-4 w-4 animate-pulse text-primary"
              aria-hidden="true"
            />
            <CardTitle className="text-base">Generating forecast…</CardTitle>
          </CardHeader>
          <CardContent>
            <ForecastSkeleton />
          </CardContent>
        </Card>
      ) : forecast !== null ? (
        <ForecastResultPanel forecast={forecast} />
      ) : error === null ? (
        <EmptyState
          icon={LineChart}
          title="No forecast yet"
          description="Pick a forecast type above to generate an AI projection from your historical data."
        />
      ) : null}
    </motion.div>
  );
}
