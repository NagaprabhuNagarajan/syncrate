"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Download, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type {
  Supplier,
  SupplierLedger,
  SupplierLedgerEntry,
} from "@/features/supplier/types/supplier.types";

// ─────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatINR(value: number): string {
  return inrFormatter.format(value);
}

function formatDate(value: Date): string {
  return new Date(value).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────
// Reference type mapping
// ─────────────────────────────────────────────────────────────

const REF_TYPE_LABELS: Record<string, string> = {
  purchase_invoice: "Invoice",
  supplier_payment: "Payment",
  purchase_return: "Return",
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

function exportCsv(entries: readonly SupplierLedgerEntry[], supplierName: string): void {
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
  anchor.download = `${supplierName.replace(/\s+/g, "-").toLowerCase()}-ledger.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

interface SupplierLedgerViewProps {
  readonly supplier: Supplier;
  readonly ledger: SupplierLedger;
}

export function SupplierLedgerView({ supplier, ledger }: SupplierLedgerViewProps) {
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
        href={`/suppliers/${supplier.id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to {supplier.name}
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Supplier Ledger — {supplier.name}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{supplier.code}</p>
        </div>
        {ledger.entries.length > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => { exportCsv(ledger.entries, supplier.name); }}
          >
            <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Outstanding balance card */}
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-center gap-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Outstanding Balance
            </p>
            <p className="nums mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
              {formatINR(ledger.outstanding)}
            </p>
          </div>
          <div className="h-10 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-xs text-muted-foreground">Opening Balance</p>
              <p className="nums mt-0.5 font-semibold text-slate-700 dark:text-slate-300">
                {formatINR(ledger.openingBalance)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Debits</p>
              <p className="nums mt-0.5 font-semibold text-red-600 dark:text-red-400">
                {formatINR(totalDebits)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Credits</p>
              <p className="nums mt-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                {formatINR(totalCredits)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Closing Balance</p>
              <p className="nums mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                {formatINR(ledger.outstanding)}
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
          description="Ledger entries will appear here once this supplier has invoices, payments, or adjustments."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Reference
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Description
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Debit
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Credit
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ledger.entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-400">
                      {formatDate(entry.entryDate)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-slate-300">
                      {mapRefType(entry.referenceType)}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                      {entry.description ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right nums font-medium text-red-600 dark:text-red-400">
                      {entry.debit > 0 ? formatINR(entry.debit) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right nums font-medium text-emerald-600 dark:text-emerald-400">
                      {entry.credit > 0 ? formatINR(entry.credit) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right nums font-semibold text-slate-900 dark:text-slate-100">
                      {formatINR(entry.runningBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}
