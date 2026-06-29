"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { DollarSign, AlertCircle, X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { recordCustomerPaymentAction } from "@/features/payment/actions/customer-payment.actions";
import type { PaymentMethod } from "@/features/payment/types/payment.types";
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

const labelClass = "block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface OutstandingInvoice {
  readonly id: string;
  readonly invoiceNumber: string;
  readonly totalAmount: number;
  readonly amountPaid: number;
  readonly outstandingAmount: number;
}

interface AllocationRow {
  key: string;
  invoiceId: string;
  amount: string;
}

interface RecordCustomerPaymentDialogProps {
  readonly organizationId: string;
  readonly customerId: string;
  readonly customerName: string;
  readonly outstandingInvoices?: readonly OutstandingInvoice[];
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
  outstandingInvoices = [],
  onClose,
  onDone,
}: RecordCustomerPaymentDialogProps) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("bank_transfer");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0] ?? ""
  );
  const [notes, setNotes] = useState("");
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalAmount = Number(amount) || 0;
  const totalAllocated = allocations.reduce(
    (sum, a) => sum + (Number(a.amount) || 0),
    0
  );
  const remaining = totalAmount - totalAllocated;

  function addAllocation(): void {
    setAllocations((prev) => [
      ...prev,
      { key: `alloc-${Date.now()}`, invoiceId: "", amount: "" },
    ]);
  }

  function removeAllocation(index: number): void {
    setAllocations((prev) => prev.filter((_, i) => i !== index));
  }

  function updateAllocation(
    index: number,
    field: keyof AllocationRow,
    value: string
  ): void {
    setAllocations((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);

    if (!amount || Number(amount) <= 0) {
      setError("Payment amount must be greater than 0");
      return;
    }

    if (totalAllocated > totalAmount) {
      setError(
        `Total allocated (${totalAllocated.toFixed(2)}) exceeds payment amount (${totalAmount.toFixed(2)})`
      );
      return;
    }

    const validAllocations = allocations
      .filter((a) => a.invoiceId && Number(a.amount) > 0)
      .map((a) => ({ invoiceId: a.invoiceId, amount: Number(a.amount) }));

    const formData = new FormData();
    formData.set("customerId", customerId);
    formData.set("amount", amount);
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
    formData.set("allocations", JSON.stringify(validAllocations));

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
            <DollarSign
              className="h-5 w-5 text-white"
              aria-hidden="true"
            />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Record Payment
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{customerName}</p>
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
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Amount */}
              <div>
                <label htmlFor="pay-amount" className={labelClass}>
                  Payment Amount <span className="text-red-500">*</span>
                </label>
                <Input
                  id="pay-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="nums"
                  aria-required="true"
                />
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

            {/* Invoice Allocations */}
            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Allocate to Invoices
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Optionally allocate this payment across outstanding invoices
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addAllocation}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/50"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add Invoice
                </button>
              </div>

              {allocations.length > 0 && (
                <div className="space-y-2">
                  {allocations.map((row, index) => (
                    <div
                      key={row.key}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex-1">
                        {outstandingInvoices.length > 0 ? (
                          <select
                            value={row.invoiceId}
                            onChange={(e) =>
                              updateAllocation(index, "invoiceId", e.target.value)
                            }
                            className={cn(inputClass, "appearance-none")}
                            aria-label={`Invoice for allocation ${index + 1}`}
                          >
                            <option value="">Select invoice</option>
                            {outstandingInvoices.map((inv) => (
                              <option key={inv.id} value={inv.id}>
                                {inv.invoiceNumber} — ₹
                                {inv.outstandingAmount.toFixed(2)} outstanding
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            type="text"
                            value={row.invoiceId}
                            onChange={(e) =>
                              updateAllocation(
                                index,
                                "invoiceId",
                                e.target.value
                              )
                            }
                            placeholder="Invoice ID (UUID)"
                            aria-label={`Invoice ID for allocation ${index + 1}`}
                          />
                        )}
                      </div>
                      <div className="w-36">
                        <Input
                          type="number"
                          value={row.amount}
                          onChange={(e) =>
                            updateAllocation(index, "amount", e.target.value)
                          }
                          placeholder="Amount"
                          min="0.01"
                          step="0.01"
                          className="nums"
                          aria-label={`Amount for allocation ${index + 1}`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAllocation(index)}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-slate-500 dark:hover:bg-red-500/10"
                        aria-label={`Remove allocation ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Running total */}
              {totalAmount > 0 && allocations.length > 0 && (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                  <span className="nums text-sm text-slate-600 dark:text-slate-400">
                    Allocated: ₹{totalAllocated.toFixed(2)} of ₹
                    {totalAmount.toFixed(2)}
                  </span>
                  <span
                    className={cn(
                      "nums text-sm font-medium",
                      remaining < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-green-600 dark:text-green-400"
                    )}
                  >
                    {remaining >= 0
                      ? `₹${remaining.toFixed(2)} unallocated`
                      : `₹${Math.abs(remaining).toFixed(2)} over-allocated`}
                  </span>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-500/30 dark:bg-red-500/10"
                role="alert"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
                  aria-hidden="true"
                />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </motion.div>
            )}
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
            <Button type="submit" variant="gradient" disabled={isPending}>
              {isPending ? "Recording…" : "Record Payment"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
