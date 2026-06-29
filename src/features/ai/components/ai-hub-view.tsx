"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bot,
  ScanText,
  TrendingUp,
  Lightbulb,
  Sparkles,
  Search,
  FileBarChart,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import type { AiCapability, AiInteraction } from "@/features/ai/types/ai.types";

interface AiCapabilityCard {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly href: string;
  readonly icon: LucideIcon;
}

const CAPABILITIES: readonly AiCapabilityCard[] = [
  {
    key: "assistant",
    label: "Business Assistant",
    description:
      "Ask questions, search your business, and prepare invoices for review.",
    href: "/ai/assistant",
    icon: Bot,
  },
  {
    key: "ocr",
    label: "Document OCR",
    description: "Extract structured data from bills, invoices, and receipts.",
    href: "/ai/ocr",
    icon: ScanText,
  },
  {
    key: "forecasting",
    label: "Forecasting",
    description: "Project sales, inventory, revenue, and cash flow.",
    href: "/ai/forecasting",
    icon: TrendingUp,
  },
  {
    key: "recommendations",
    label: "Recommendations",
    description: "Reorder, supplier, and follow-up suggestions with reasons.",
    href: "/ai/recommendations",
    icon: Sparkles,
  },
  {
    key: "insights",
    label: "Business Insights",
    description: "Trends, risks, and opportunities across your operations.",
    href: "/ai/insights",
    icon: Lightbulb,
  },
  {
    key: "search",
    label: "Smart Search",
    description: "Find anything using plain-language queries.",
    href: "/ai/search",
    icon: Search,
  },
  {
    key: "reports",
    label: "Smart Reports",
    description: "Generate narrative reports with charts and actions.",
    href: "/ai/reports",
    icon: FileBarChart,
  },
];

const CAPABILITY_LABELS: Record<AiCapability, string> = {
  assistant: "Assistant",
  ocr: "OCR",
  forecast: "Forecast",
  recommendation: "Recommendation",
  insight: "Insight",
  search: "Search",
  report: "Report",
};

const STATUS_VARIANT: Record<
  AiInteraction["status"],
  "success" | "destructive" | "warning"
> = {
  success: "success",
  failed: "destructive",
  refused: "warning",
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ActivityRow({ item }: { readonly item: AiInteraction }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <span className="font-medium text-slate-700 dark:text-slate-300">
          {CAPABILITY_LABELS[item.capability]}
        </span>
        <span className="truncate text-slate-400 dark:text-slate-500">{item.model}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {item.confidence !== null && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {Math.round(item.confidence * 100)}%
          </span>
        )}
        <Badge variant={STATUS_VARIANT[item.status]}>{item.status}</Badge>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {formatTime(item.createdAt)}
        </span>
      </div>
    </li>
  );
}

interface AiHubViewProps {
  readonly recentActivity: readonly AiInteraction[];
  readonly aiConfigured: boolean;
}

/** Landing hub for the AI Platform: capability launcher + recent activity. */
export function AiHubView({ recentActivity, aiConfigured }: AiHubViewProps) {
  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 shadow-sm">
          <Sparkles className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">AI Platform</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Intelligent automation, insights, and assistance across your business.
          </p>
        </div>
      </div>

      {!aiConfigured && (
        <div
          className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300"
          role="status"
        >
          AI is not yet configured. Set <code>ANTHROPIC_API_KEY</code> to enable
          these features.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CAPABILITIES.map((cap, index) => {
          const Icon = cap.icon;
          return (
            <motion.div
              key={cap.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
            >
              <Link href={cap.href} className="block h-full">
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <CardTitle className="mt-3 text-base">{cap.label}</CardTitle>
                    <CardDescription>{cap.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent AI activity</CardTitle>
          <CardDescription>
            Every AI interaction is audited for transparency and governance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <EmptyState
              title="No AI activity yet"
              description="Run an AI capability to see its audited history here."
            />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentActivity.map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
