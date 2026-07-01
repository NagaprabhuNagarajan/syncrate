"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Download, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatDate } from "@/utils/format";
import type {
  Customer,
  CustomerLedger,
  CustomerLedgerEntry,
} from "@/features/customer/types/customer.types";

// ─────────────────────────────────────────────────────────────
// Reference type mapping
// ─────────────────────────────────────────────────────────────

const REF_TYPE_LABELS: Record<string, string> = {
  sales_invoice: "Invoice",
  customer_payment: "Payment",
  sales_return: "Return",
  opening_balance: "Opening Balance",
};

function mapRefType(refType: string | null): string {
  if (refType === null) {
    return "—";
  }
  return REF_TYPE_LABELS[refType] ?? refType;
}

// ─────────────────────────────────────────────────────────────
// CSV export
// ─────────────────────────────────────────────────────────────

function exportCsv(entries: readonly CustomerLedgerEntry[], customerName: string): void {
  const header = ["Date", "Reference Type", "Description", "Debit", "Credit", "Balance"];
  const rows = entries.map((e) => [
    formatDate(e.entryDate),
    mapRefType(e.referenceType),
    e.description ?? "",
    e.debit.toFixed(2),
    e.credit.toFixed(2),
    e.runningBalance.toFixed(2),
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${customerName.replace(/\s+/g, "-").toLowerCase()}-ledger.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

interface CustomerLedgerViewProps {
  readonly customer: Customer;
  readonly ledger: CustomerLedger;
}

export function CustomerLedgerView({ customer, ledger }: CustomerLedgerViewProps) {
  const totalDebits = ledger.entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredits = ledger.entries.reduce((sum, e) => sum + e.credit, 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="p-4 lg:p-6"
    >
      {/* Back */}
      <Link
        href={`/customers/${customer.id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to {customer.name}
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Customer Ledger — {customer.name}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{customer.code}</p>
        </div>
        {ledger.entries.length > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => { exportCsv(ledger.entries, customer.name); }}
          >
            <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Outstanding balance card */}
      <Card hover className="mb-6 p-5">
        <div className="flex flex-wrap items-center gap-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Outstanding Balance
            </p>
            <p className="nums mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
              {formatCurrency(ledger.outstanding, true)}
            </p>
          </div>
          <div className="h-10 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-xs text-muted-foreground">Opening Balance</p>
              <p className="nums mt-0.5 font-semibold text-slate-700 dark:text-slate-300">
                {formatCurrency(ledger.openingBalance, true)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Debits</p>
              <p className="nums mt-0.5 font-semibold text-red-600 dark:text-red-400">
                {formatCurrency(totalDebits, true)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Credits</p>
              <p className="nums mt-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalCredits, true)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Closing Balance</p>
              <p className="nums mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(ledger.outstanding, true)}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Ledger table */}
      {ledger.entries.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No ledger entries"
          description="Ledger entries will appear here once this customer has invoices, payments, or adjustments."
        />
      ) : (
        <Table wrapperClassName="shadow-card">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ledger.entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap text-slate-600 dark:text-slate-400">
                  {formatDate(entry.entryDate)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-slate-700 dark:text-slate-300">
                  {mapRefType(entry.referenceType)}
                </TableCell>
                <TableCell className="text-slate-600 dark:text-slate-400">
                  {entry.description ?? "—"}
                </TableCell>
                <TableCell className="nums whitespace-nowrap text-right font-medium text-red-600 dark:text-red-400">
                  {entry.debit > 0 ? formatCurrency(entry.debit, true) : "—"}
                </TableCell>
                <TableCell className="nums whitespace-nowrap text-right font-medium text-emerald-600 dark:text-emerald-400">
                  {entry.credit > 0 ? formatCurrency(entry.credit, true) : "—"}
                </TableCell>
                <TableCell className="nums whitespace-nowrap text-right font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(entry.runningBalance, true)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </motion.div>
  );
}
