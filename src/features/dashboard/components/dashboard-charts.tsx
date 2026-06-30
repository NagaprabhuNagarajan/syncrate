"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type {
  MonthlyTrendPoint,
  AgingBucket,
  StatusSlice,
  TopEntity,
} from "@/features/dashboard/services/dashboard-analytics.service";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────

/** Compact INR: ₹1.2L / ₹3.4K / ₹500. */
function formatCompactINR(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e7) {
    return `₹${(value / 1e7).toFixed(1)}Cr`;
  }
  if (abs >= 1e5) {
    return `₹${(value / 1e5).toFixed(1)}L`;
  }
  if (abs >= 1e3) {
    return `₹${(value / 1e3).toFixed(1)}K`;
  }
  return `₹${value}`;
}

const AXIS = "hsl(var(--muted-foreground))";
const GRID = "hsl(var(--border))";

const STATUS_COLORS: Record<string, string> = {
  paid: "#16a34a",
  partial: "#f59e0b",
  unpaid: "#ef4444",
};

// ─────────────────────────────────────────────────────────────
// Shared tooltip
// ─────────────────────────────────────────────────────────────

interface TooltipEntry {
  readonly name?: string;
  readonly value?: number | string;
  readonly color?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  readonly active?: boolean;
  readonly payload?: TooltipEntry[];
  readonly label?: string | number;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <div className="glass-panel rounded-lg px-3 py-2 text-xs shadow-lg">
      {label !== undefined && (
        <p className="mb-1 font-semibold text-foreground">{label}</p>
      )}
      {payload.map((p, i) => (
        <div key={p.name ?? i} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="capitalize text-muted-foreground">{p.name}</span>
          <span className="nums ml-auto font-medium text-foreground">
            {typeof p.value === "number" ? formatCompactINR(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sales vs Purchases trend (area)
// ─────────────────────────────────────────────────────────────

export function SalesTrendChart({ data }: { readonly data: MonthlyTrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradPurch" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="month" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke={AXIS}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={formatCompactINR}
        />
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="sales"
          name="Sales"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#gradSales)"
        />
        <Area
          type="monotone"
          dataKey="purchases"
          name="Purchases"
          stroke="#8b5cf6"
          strokeWidth={2}
          fill="url(#gradPurch)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─────────────────────────────────────────────────────────────
// Aging (grouped bars: receivable vs payable)
// ─────────────────────────────────────────────────────────────

export function AgingChart({ data }: { readonly data: AgingBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="bucket" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke={AXIS}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={formatCompactINR}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
        <Bar dataKey="receivable" name="Receivable" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="payable" name="Payable" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─────────────────────────────────────────────────────────────
// Invoice status donut
// ─────────────────────────────────────────────────────────────

export function InvoiceStatusChart({ data }: { readonly data: StatusSlice[] }) {
  const total = data.reduce((acc, d) => acc + d.count, 0);
  if (total === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        No posted invoices yet
      </div>
    );
  }
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="55%" height={200}>
        <PieChart>
          <Pie
            data={data as StatusSlice[]}
            dataKey="count"
            nameKey="label"
            innerRadius={52}
            outerRadius={80}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((d) => (
              <Cell key={d.status} fill={STATUS_COLORS[d.status] ?? "#94a3b8"} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 space-y-2">
        {data.map((d) => (
          <li key={d.status} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[d.status] ?? "#94a3b8" }}
            />
            <span className="text-muted-foreground">{d.label}</span>
            <span className="nums ml-auto font-semibold text-foreground">
              {d.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Top-N ranked bar list (customers / products)
// ─────────────────────────────────────────────────────────────

export function TopList({
  data,
  emptyLabel,
  accent = "from-blue-500 to-indigo-500",
}: {
  readonly data: TopEntity[];
  readonly emptyLabel: string;
  readonly accent?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.amount), 1);
  return (
    <ul className="space-y-3">
      {data.map((d, i) => (
        <li key={d.name} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate font-medium text-foreground">
              {i + 1}. {d.name}
            </span>
            <span className="nums ml-2 shrink-0 text-muted-foreground">
              {formatCompactINR(d.amount)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full bg-gradient-to-r", accent)}
              style={{ width: `${Math.max(4, (d.amount / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
