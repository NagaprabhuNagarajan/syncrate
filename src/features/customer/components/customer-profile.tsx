"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Users,
  Pencil,
  Archive,
  AlertTriangle,
  Mail,
  Phone,
  Globe,
  MapPin,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { archiveCustomerAction } from "@/features/customer/actions/customer.actions";
import type {
  Customer,
  CustomerLedger,
  CustomerStatus,
} from "@/features/customer/types/customer.types";

const STATUS_VARIANT: Record<CustomerStatus, BadgeProps["variant"]> = {
  active: "success",
  inactive: "muted",
  blacklisted: "destructive",
  archived: "secondary",
};

const STATUS_LABEL: Record<CustomerStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  blacklisted: "Blacklisted",
  archived: "Archived",
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatDate(value: Date): string {
  return new Date(value).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────
// Archive confirmation dialog
// ─────────────────────────────────────────────────────────────

interface ArchiveDialogProps {
  readonly customerName: string;
  readonly isPending: boolean;
  readonly error: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function ArchiveDialog({
  customerName,
  isPending,
  error,
  onConfirm,
  onCancel,
}: ArchiveDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-customer-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start gap-4">
          <div className="bg-error-50 dark:bg-error-500/10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <AlertTriangle
              className="text-error-600 dark:text-error-400 h-5 w-5"
              aria-hidden="true"
            />
          </div>
          <div>
            <h2
              id="archive-customer-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Archive customer
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Are you sure you want to archive{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">{customerName}</span>?
              Archived customers cannot receive new invoices.
            </p>
          </div>
        </div>

        {error && (
          <div
            className="border-error-200 bg-error-50 text-error-800 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300 mt-4 rounded-lg border px-4 py-3 text-sm"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            loading={isPending}
            disabled={isPending}
          >
            Archive customer
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Info row
// ─────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  readonly icon: typeof Mail;
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
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-slate-700 dark:text-slate-300">{value}</dd>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Customer profile
// ─────────────────────────────────────────────────────────────

interface CustomerProfileProps {
  readonly customer: Customer;
  readonly ledger: CustomerLedger;
  readonly organizationId: string;
  readonly canManage: boolean;
}

export function CustomerProfile({
  customer,
  ledger,
  organizationId,
  canManage,
}: CustomerProfileProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showArchive, setShowArchive] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const org = searchParams.get("org");
  const editHref = org
    ? `/customers/${customer.id}/edit?org=${org}`
    : `/customers/${customer.id}/edit`;

  const billingAddress = [
    customer.billingAddressLine1,
    customer.billingAddressLine2,
    customer.billingCity,
    customer.billingState,
    customer.billingPincode,
  ]
    .filter(Boolean)
    .join(", ");

  const handleArchive = () => {
    setArchiveError(null);
    startTransition(async () => {
      const result = await archiveCustomerAction(organizationId, customer.id);
      if (!result.success) {
        setArchiveError(result.error.message);
        return;
      }
      setShowArchive(false);
      router.push("/customers");
    });
  };

  return (
    <div className="p-6 lg:p-8">
      <PageHeader title={customer.name} description={customer.code} icon={Users}>
        {canManage && (
          <>
            <Button asChild variant="outline">
              <Link href={editHref}>
                <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Edit
              </Link>
            </Button>
            {customer.status !== "archived" && (
              <Button
                type="button"
                variant="ghost"
                className="text-error-600 hover:bg-error-50 hover:text-error-700 dark:text-error-400 dark:hover:bg-error-500/10 dark:hover:text-error-300"
                onClick={() => {
                  setArchiveError(null);
                  setShowArchive(true);
                }}
              >
                <Archive className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Archive
              </Button>
            )}
          </>
        )}
      </PageHeader>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_VARIANT[customer.status]}>
          {STATUS_LABEL[customer.status]}
        </Badge>
        {customer.tags.map((tag) => (
          <Badge key={tag} variant="info">
            {tag}
          </Badge>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Details */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Customer details
          </h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoRow icon={Users} label="Company" value={customer.company} />
            <InfoRow icon={Phone} label="Mobile" value={customer.mobile} />
            <InfoRow icon={Mail} label="Email" value={customer.email} />
            <InfoRow icon={Globe} label="Website" value={customer.website} />
            <InfoRow icon={Users} label="GST number" value={customer.gstNumber} />
            <InfoRow icon={Users} label="PAN number" value={customer.panNumber} />
            <InfoRow
              icon={MapPin}
              label="Billing address"
              value={billingAddress || null}
            />
            <InfoRow
              icon={Users}
              label="Preferred payment"
              value={customer.preferredPaymentMethod}
            />
          </dl>
          {customer.notes && (
            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <dt className="text-xs text-muted-foreground">Notes</dt>
              <dd className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                {customer.notes}
              </dd>
            </div>
          )}
        </Card>

        {/* Financials */}
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Financials
          </h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-xs text-muted-foreground">Outstanding</dt>
              <dd className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(ledger.outstanding)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Opening balance</dt>
              <dd className="text-base font-medium text-slate-700 dark:text-slate-300">
                {formatCurrency(ledger.openingBalance)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Credit limit</dt>
              <dd className="text-base font-medium text-slate-700 dark:text-slate-300">
                {formatCurrency(customer.creditLimit)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Payment terms</dt>
              <dd className="text-base font-medium text-slate-700 dark:text-slate-300">
                {customer.paymentTermsDays} days
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* Ledger */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ledger</h2>
          <Link
            href={`/customers/${customer.id}/ledger`}
            className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            View full ledger →
          </Link>
        </div>
        {ledger.entries.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No ledger entries yet"
            description="Ledger entries appear here once this customer has sales, payments or adjustments."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Date
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
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ledger.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {formatDate(entry.entryDate)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {entry.description ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {formatCurrency(entry.debit)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {formatCurrency(entry.credit)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrency(entry.runningBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showArchive && (
          <ArchiveDialog
            customerName={customer.name}
            isPending={isPending}
            error={archiveError}
            onConfirm={handleArchive}
            onCancel={() => setShowArchive(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
