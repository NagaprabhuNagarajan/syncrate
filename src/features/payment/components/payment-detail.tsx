"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Calendar,
  ChevronLeft,
  CircleDollarSign,
  Coins,
  FileText,
  Hash,
  StickyNote,
  User,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import { KpiTile } from "@/components/shared/kpi-tile";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/utils/format";
import type {
  PaymentMethod,
  PaymentStatus,
  PaymentWithAllocations,
} from "@/features/payment/types/payment.types";

// ─────────────────────────────────────────────────────────────
// Display maps (kept local to avoid coupling with payments-view)
// ─────────────────────────────────────────────────────────────

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
  credit_card: "Credit Card",
  debit_card: "Debit Card",
  wallet: "Wallet",
  other: "Other",
};

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  completed: "Completed",
  voided: "Voided",
};

const PAYMENT_STATUS_VARIANT: Record<PaymentStatus, BadgeProps["variant"]> = {
  completed: "success",
  voided: "destructive",
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatDateString(value: string | null): string | null {
  return value ? formatDate(new Date(value)) : null;
}

// ─────────────────────────────────────────────────────────────
// Info row + section card
// ─────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: string | null;
}) {
  if (!value) {
    return null;
  }
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-words text-slate-700 dark:text-slate-300">
          {value}
        </dd>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  children,
  delay,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay }}
    >
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {children}
      </Card>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Detail
// ─────────────────────────────────────────────────────────────

interface PaymentDetailProps {
  readonly payment: PaymentWithAllocations;
  readonly invoiceNumbers?: Readonly<Record<string, string>>;
}

export function PaymentDetail({
  payment,
  invoiceNumbers = {},
}: PaymentDetailProps) {
  const searchParams = useSearchParams();
  const org = searchParams.get("org");
  const withOrg = (path: string): string =>
    org ? `${path}?org=${org}` : path;

  const { status } = payment;
  const isVoided = status === "voided";
  const partyName = payment.customerName ?? payment.customerId;
  const totalAllocated = payment.allocations.reduce(
    (sum, allocation) => sum + allocation.allocatedAmount,
    0
  );
  const unallocated = payment.amount - totalAllocated;

  return (
    <div className="p-4 lg:p-6">
      {/* Back link */}
      <Link
        href={withOrg("/payments")}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Payments
      </Link>

      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-4 mb-5 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/80 lg:-mx-6 lg:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-mono text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {payment.paymentNumber}
              </h1>
              <Badge dot variant={PAYMENT_STATUS_VARIANT[status]}>
                {PAYMENT_STATUS_LABEL[status]}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {partyName}
              {` · ${formatDate(new Date(payment.paymentDate))}`}
            </p>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          icon={CircleDollarSign}
          label="Amount"
          value={payment.amount}
          tint="bg-gradient-brand"
          emphasis
          index={0}
        />
        <KpiTile
          icon={Calendar}
          label="Payment date"
          value={0}
          displayValue={formatDate(new Date(payment.paymentDate))}
          tint="bg-gradient-success"
          index={1}
        />
        <KpiTile
          icon={Wallet}
          label="Method"
          value={0}
          displayValue={METHOD_LABELS[payment.paymentMethod]}
          tint="bg-gradient-violet"
          index={2}
        />
        <KpiTile
          icon={Coins}
          label="Unallocated"
          value={unallocated}
          tint="bg-gradient-info"
          index={3}
        />
      </div>

      {/* Two-column body */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 lg:col-span-2">
          <SectionCard title="Invoice allocations" delay={0.1}>
            {payment.allocations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This payment has not been allocated to any invoices.
              </p>
            ) : (
              <>
                <Table wrapperClassName="shadow-none">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead className="text-right">
                        Allocated amount
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payment.allocations.map((allocation) => (
                      <TableRow key={allocation.id}>
                        <TableCell>
                          <Link
                            href={withOrg(`/invoices/${allocation.invoiceId}`)}
                            className="font-mono text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
                          >
                            {invoiceNumbers[allocation.invoiceId] ??
                              allocation.invoiceId}
                          </Link>
                        </TableCell>
                        <TableCell className="nums text-right font-medium text-slate-700 dark:text-slate-300">
                          {formatCurrency(allocation.allocatedAmount, true)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Total allocated</dt>
                    <dd className="nums text-slate-700 dark:text-slate-300">
                      {formatCurrency(totalAllocated, true)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Payment amount</dt>
                    <dd className="nums text-slate-700 dark:text-slate-300">
                      {formatCurrency(payment.amount, true)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                    <dt className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Unallocated
                    </dt>
                    <dd className="nums text-slate-900 dark:text-slate-100">
                      {formatCurrency(unallocated, true)}
                    </dd>
                  </div>
                </dl>
              </>
            )}
          </SectionCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <SectionCard title="Details" delay={0.1}>
            <dl className="space-y-4">
              <InfoRow icon={User} label="Customer" value={partyName} />
              <InfoRow
                icon={Wallet}
                label="Payment method"
                value={METHOD_LABELS[payment.paymentMethod]}
              />
              <InfoRow
                icon={Hash}
                label="Reference number"
                value={payment.referenceNumber}
              />
              <InfoRow
                icon={Calendar}
                label="Payment date"
                value={formatDate(new Date(payment.paymentDate))}
              />
              <InfoRow
                icon={FileText}
                label="Status"
                value={PAYMENT_STATUS_LABEL[status]}
              />
              <InfoRow
                icon={StickyNote}
                label="Notes"
                value={payment.notes}
              />
            </dl>
          </SectionCard>

          <SectionCard title="Timeline" delay={0.15}>
            <dl className="space-y-4">
              <InfoRow
                icon={Calendar}
                label="Created"
                value={formatDateString(payment.createdAt)}
              />
              <InfoRow
                icon={Calendar}
                label="Last updated"
                value={formatDateString(payment.updatedAt)}
              />
              {isVoided && (
                <>
                  <InfoRow
                    icon={XCircle}
                    label="Voided"
                    value={formatDateString(payment.voidedAt)}
                  />
                  <InfoRow
                    icon={StickyNote}
                    label="Void reason"
                    value={payment.voidReason}
                  />
                </>
              )}
            </dl>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
