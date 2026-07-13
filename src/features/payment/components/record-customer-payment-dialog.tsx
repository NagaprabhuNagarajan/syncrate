"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { DollarSign, X, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorBanner } from "@/components/shared/error-banner";
import {
  getOutstandingCustomerInvoicesAction,
  recordCustomerPaymentAction,
} from "@/features/payment/actions/customer-payment.actions";
import type {
  OutstandingTransaction,
  PaymentMethod,
} from "@/features/payment/types/payment.types";
import { formatCurrency, formatDate } from "@/utils/format";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
  credit_card: "Credit Card",
  debit_card: "Debit Card",
  wallet: "Wallet",
  other: "Other",
};

const PAYMENT_METHODS = Object.entries(PAYMENT_METHOD_LABELS) as [
  PaymentMethod,
  string,
][];

const inputClass =
  "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-slate-900 shadow-sm transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-muted-foreground hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-slate-100 dark:hover:border-slate-600";

const labelClass =
  "block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Rounds to 2 decimal places, avoiding binary float drift. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface PartyOption {
  readonly id: string;
  readonly name: string;
}

interface RecordCustomerPaymentDialogProps {
  readonly organizationId: string;
  /** Pre-seeded customer. When empty, the party picker is shown instead. */
  readonly customerId: string;
  readonly customerName: string;
  /** Selectable customers for the picker (used only when `customerId` is empty). */
  readonly customers?: readonly PartyOption[];
  /**
   * Override the fetched outstanding list (e.g. from invoice detail / bulk
   * flows). When provided, the dialog uses these rows instead of querying.
   */
  readonly outstandingInvoices?: readonly OutstandingTransaction[];
  /** Invoice ids to pre-check once the outstanding list is loaded. */
  readonly preselectedInvoiceIds?: readonly string[];
  readonly onClose: () => void;
  readonly onDone: () => void;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function RecordCustomerPaymentDialog({
  organizationId,
  customerId,
  customerName,
  customers = [],
  outstandingInvoices,
  preselectedInvoiceIds,
  onClose,
  onDone,
}: RecordCustomerPaymentDialogProps) {
  const isPreseeded = customerId !== "";

  const [pickedCustomerId, setPickedCustomerId] = useState("");
  const effectiveCustomerId = isPreseeded ? customerId : pickedCustomerId;

  const [transactions, setTransactions] = useState<
    readonly OutstandingTransaction[]
  >([]);
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(new Set());
  const [amountInput, setAmountInput] = useState("");
  const [loadingTx, setLoadingTx] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("bank_transfer");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0] ?? ""
  );
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Keep the latest override/preselection without retriggering the loader,
  // whose only real inputs are the org + effective customer.
  const overrideRef = useRef(outstandingInvoices);
  overrideRef.current = outstandingInvoices;
  const preselectRef = useRef(preselectedInvoiceIds);
  preselectRef.current = preselectedInvoiceIds;

  useEffect(() => {
    function applyRows(rows: readonly OutstandingTransaction[]): void {
      setTransactions(rows);
      const preselect = preselectRef.current;
      if (preselect && preselect.length > 0) {
        const wanted = new Set(preselect);
        setCheckedIds(
          new Set(rows.filter((r) => wanted.has(r.id)).map((r) => r.id))
        );
      } else {
        setCheckedIds(new Set());
      }
    }

    if (!effectiveCustomerId) {
      setTransactions([]);
      setCheckedIds(new Set());
      setLoadError(null);
      return;
    }

    const override = overrideRef.current;
    if (override && override.length > 0) {
      applyRows(override);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoadingTx(true);
    setLoadError(null);
    void getOutstandingCustomerInvoicesAction(
      organizationId,
      effectiveCustomerId
    ).then((result) => {
      if (cancelled) {
        return;
      }
      setLoadingTx(false);
      if (!result.success) {
        setTransactions([]);
        setCheckedIds(new Set());
        setLoadError(result.error.message);
        return;
      }
      applyRows(result.data);
    });

    return () => {
      cancelled = true;
    };
  }, [organizationId, effectiveCustomerId]);

  const checkedTransactions = useMemo(
    () => transactions.filter((t) => checkedIds.has(t.id)),
    [transactions, checkedIds]
  );
  const totalAmount = round2(
    checkedTransactions.reduce((sum, t) => sum + t.outstandingAmount, 0)
  );

  // Default the payable amount to the full selected total; it resets whenever
  // the selection changes, but the user may lower it for a partial payment.
  useEffect(() => {
    setAmountInput(totalAmount > 0 ? String(totalAmount) : "");
  }, [totalAmount]);

  const payAmount = round2(Number(amountInput) || 0);
  const amountValid = payAmount > 0;

  // Distribute the payment across the selected invoices oldest-first (the query
  // returns them ascending by date): each older invoice is settled in full and
  // any shortfall lands as a partial payment on the latest selected invoice.
  // Each invoice is capped at its outstanding, so any amount beyond the total
  // outstanding stays unallocated → an advance / on-account credit.
  const allocations = useMemo(() => {
    let remaining = payAmount;
    const out: { readonly id: string; readonly amount: number }[] = [];
    for (const t of checkedTransactions) {
      if (remaining <= 0) {
        break;
      }
      const alloc = round2(Math.min(remaining, t.outstandingAmount));
      if (alloc > 0) {
        out.push({ id: t.id, amount: alloc });
        remaining = round2(remaining - alloc);
      }
    }
    return out;
  }, [checkedTransactions, payAmount]);

  const allocById = useMemo(
    () => new Map(allocations.map((a) => [a.id, a.amount])),
    [allocations]
  );
  const allocatedTotal = round2(
    allocations.reduce((sum, a) => sum + a.amount, 0)
  );
  const advance = round2(payAmount - allocatedTotal);
  const isPartial = amountValid && payAmount < totalAmount;

  const displayName = isPreseeded
    ? customerName
    : (customers.find((c) => c.id === pickedCustomerId)?.name ??
      "Select a customer");

  // A payment may settle invoices, be a pure advance (no invoices), or both —
  // so it only needs a party and a positive amount.
  const canSubmit =
    Boolean(effectiveCustomerId) && amountValid && !isPending;

  function toggleInvoice(id: string): void {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handlePickCustomer(
    event: React.ChangeEvent<HTMLSelectElement>
  ): void {
    setPickedCustomerId(event.target.value);
    setError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);

    if (!effectiveCustomerId) {
      setError("Please select a customer");
      return;
    }
    if (!amountValid) {
      setError("Enter a payment amount greater than 0");
      return;
    }

    const finalAllocations = allocations.map((a) => ({
      invoiceId: a.id,
      amount: a.amount,
    }));

    const formData = new FormData();
    formData.set("customerId", effectiveCustomerId);
    formData.set("amount", String(payAmount));
    formData.set("paymentMethod", paymentMethod);
    if (referenceNumber.trim()) {
      formData.set("referenceNumber", referenceNumber.trim());
    }
    if (paymentDate) {
      formData.set("paymentDate", paymentDate);
    }
    if (notes.trim()) {
      formData.set("notes", notes.trim());
    }
    formData.set("allocations", JSON.stringify(finalAllocations));

    startTransition(async () => {
      const result = await recordCustomerPaymentAction(
        organizationId,
        formData
      );
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      onDone();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Record customer payment"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5 dark:border-slate-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
            <DollarSign className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Record Payment
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {displayName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
            {/* Party picker (only when not pre-seeded) */}
            {!isPreseeded && (
              <div>
                <label htmlFor="pay-customer" className={labelClass}>
                  Customer <span className="text-red-500">*</span>
                </label>
                <select
                  id="pay-customer"
                  value={pickedCustomerId}
                  onChange={handlePickCustomer}
                  required
                  className={cn(inputClass, "appearance-none")}
                  aria-required="true"
                >
                  <option value="">Select a customer…</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Outstanding invoices */}
            <div>
              <div className="mb-2">
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Outstanding Invoices
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Check the invoices this payment settles.
                </p>
              </div>

              {!effectiveCustomerId ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  Select a customer to see their outstanding invoices.
                </div>
              ) : loadingTx ? (
                <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Loading outstanding invoices…
                </div>
              ) : loadError ? (
                <ErrorBanner message={loadError} />
              ) : transactions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  No outstanding invoices for this customer.
                </div>
              ) : (
                <ul className="space-y-2">
                  {transactions.map((tx) => {
                    const checked = checkedIds.has(tx.id);
                    return (
                      <li key={tx.id}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                            checked
                              ? "border-primary/50 bg-primary/5 dark:border-primary/40 dark:bg-primary/10"
                              : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleInvoice(tx.id)}
                            aria-label={`Select invoice ${tx.invoiceNumber}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 font-mono text-xs font-medium text-slate-800 dark:text-slate-200">
                              <FileText
                                className="h-3.5 w-3.5 text-slate-400"
                                aria-hidden="true"
                              />
                              {tx.invoiceNumber}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {formatDate(new Date(tx.invoiceDate))} · Total{" "}
                              {formatCurrency(tx.totalAmount, true)} · Paid{" "}
                              {formatCurrency(tx.amountPaid, true)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="nums text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {formatCurrency(tx.outstandingAmount, true)}
                            </p>
                            {checked &&
                            (allocById.get(tx.id) ?? 0) < tx.outstandingAmount ? (
                              <p className="nums text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                Paying{" "}
                                {formatCurrency(allocById.get(tx.id) ?? 0, true)}
                              </p>
                            ) : (
                              <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                Outstanding
                              </p>
                            )}
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Amount received (editable — defaults to the selected total;
                  may exceed it to record an advance / on-account credit). */}
              {effectiveCustomerId && !loadingTx && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor="amount-to-pay"
                      className="text-sm font-medium text-slate-600 dark:text-slate-400"
                    >
                      Amount received
                      {checkedTransactions.length > 0 && (
                        <span className="ml-1.5 text-xs text-slate-400">
                          ({checkedTransactions.length} selected · of{" "}
                          {formatCurrency(totalAmount, true)})
                        </span>
                      )}
                    </label>
                    <Input
                      id="amount-to-pay"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      placeholder="0.00"
                      className="nums h-9 w-36 text-right text-base font-bold"
                    />
                  </div>
                  {isPartial && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                      Partial payment — older invoices are settled first; the
                      latest selected invoice takes the balance.
                    </p>
                  )}
                  {advance > 0 && (
                    <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                      {formatCurrency(advance, true)} will be recorded as an
                      advance / on-account credit (unallocated).
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Payment meta */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Payment Method */}
              <div>
                <label htmlFor="pay-method" className={labelClass}>
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <select
                  id="pay-method"
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as PaymentMethod)
                  }
                  required
                  className={cn(inputClass, "appearance-none")}
                  aria-required="true"
                >
                  {PAYMENT_METHODS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Date */}
              <div>
                <label htmlFor="pay-date" className={labelClass}>
                  Payment Date
                </label>
                <Input
                  id="pay-date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>

              {/* Reference Number */}
              <div>
                <label htmlFor="pay-ref" className={labelClass}>
                  Reference Number
                </label>
                <Input
                  id="pay-ref"
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Cheque no., UTR, etc."
                />
              </div>

              {/* Notes */}
              <div className="sm:col-span-2">
                <label htmlFor="pay-notes" className={labelClass}>
                  Notes
                </label>
                <Textarea
                  id="pay-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes (optional)"
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>

            {/* Error */}
            {error && <ErrorBanner message={error} />}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="gradient" disabled={!canSubmit}>
              {isPending ? "Recording…" : "Record Payment"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
