"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Download, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type {
  Customer,
  CustomerLedger,
  CustomerLedgerEntry,
} from "@/features/customer/types/customer.types";

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
      className="p-6 lg:p-8"
    >
      {/* Back */}
      <Link
        href={`/customers/${customer.id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to {customer.name}
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Customer Ledger — {customer.name}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">{customer.code}</p>
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
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-center gap-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Outstanding Balance
            </p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {formatINR(ledger.outstanding)}
            </p>
          </div>
          <div className="h-10 w-px bg-slate-200" aria-hidden="true" />
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-xs text-muted-foreground">Opening Balance</p>
              <p className="mt-0.5 font-semibold text-slate-700">
                {formatINR(ledger.openingBalance)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Debits</p>
              <p className="mt-0.5 font-semibold text-red-600">
                {formatINR(totalDebits)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Credits</p>
              <p className="mt-0.5 font-semibold text-emerald-600">
                {formatINR(totalCredits)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Closing Balance</p>
              <p className="mt-0.5 font-semibold text-slate-900">
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
          description="Ledger entries will appear here once this customer has invoices, payments, or adjustments."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Reference
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Description
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Debit
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Credit
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDate(entry.entryDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {mapRefType(entry.referenceType)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {entry.description ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-medium text-red-600">
                      {entry.debit > 0 ? formatINR(entry.debit) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-medium text-emerald-600">
                      {entry.credit > 0 ? formatINR(entry.credit) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
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
