"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Truck,
  Pencil,
  Archive,
  AlertTriangle,
  ArrowLeft,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { archiveSupplierAction } from "@/features/supplier/actions/supplier.actions";
import type {
  Supplier,
  SupplierLedger,
  SupplierStatus,
} from "@/features/supplier/types/supplier.types";

const STATUS_VARIANT: Record<
  SupplierStatus,
  "success" | "muted" | "secondary"
> = {
  active: "success",
  inactive: "muted",
  archived: "secondary",
};

const STATUS_LABEL: Record<SupplierStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

// ─────────────────────────────────────────────────────────────
// Detail row
// ─────────────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | null;
}) {
  if (!value) {
    return null;
  }
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-44 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </dt>
      <dd className="text-sm text-slate-700 dark:text-slate-300">{value}</dd>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Archive dialog
// ─────────────────────────────────────────────────────────────

interface ArchiveDialogProps {
  readonly supplier: Supplier;
  readonly isPending: boolean;
  readonly error: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function ArchiveDialog({
  supplier,
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
        aria-labelledby="archive-supplier-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start gap-4">
          <div className="bg-error-50 flex h-11 w-11 shrink-0 items-center justify-center rounded-full dark:bg-error-500/10">
            <AlertTriangle
              className="text-error-600 h-5 w-5 dark:text-error-400"
              aria-hidden="true"
            />
          </div>
          <div>
            <h2
              id="archive-supplier-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Archive supplier
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Are you sure you want to archive{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {supplier.name}
              </span>
              ? Archived suppliers remain available for historical reports.
            </p>
          </div>
        </div>

        {error && (
          <div
            className="border-error-200 bg-error-50 text-error-800 mt-4 rounded-lg border px-4 py-3 text-sm dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
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
            Archive supplier
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Supplier profile
// ─────────────────────────────────────────────────────────────

interface SupplierProfileProps {
  readonly organizationId: string;
  readonly supplier: Supplier;
  readonly ledger: SupplierLedger;
}

export function SupplierProfile({
  organizationId,
  supplier,
  ledger,
}: SupplierProfileProps) {
  const router = useRouter();
  const [showArchive, setShowArchive] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isArchiving, startArchiveTransition] = useTransition();

  const handleArchiveConfirm = () => {
    setArchiveError(null);
    startArchiveTransition(async () => {
      const result = await archiveSupplierAction(organizationId, supplier.id);
      if (!result.success) {
        setArchiveError(result.error.message);
        return;
      }
      setShowArchive(false);
      router.push(`/suppliers?org=${organizationId}`);
      router.refresh();
    });
  };

  const address = [
    supplier.addressLine1,
    supplier.addressLine2,
    [supplier.city, supplier.state, supplier.pincode]
      .filter(Boolean)
      .join(", "),
    supplier.country,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="p-4 lg:p-6">
      <Link
        href={`/suppliers?org=${organizationId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to suppliers
      </Link>

      <PageHeader title={supplier.name} description={supplier.code} icon={Truck}>
        <Button asChild type="button" variant="outline">
          <Link href={`/suppliers/${supplier.id}/edit?org=${organizationId}`}>
            <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Edit
          </Link>
        </Button>
        {supplier.status !== "archived" && (
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
      </PageHeader>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge dot variant={STATUS_VARIANT[supplier.status]}>
          {STATUS_LABEL[supplier.status]}
        </Badge>
        {supplier.rating !== null && (
          <span className="inline-flex items-center gap-0.5 text-sm font-medium text-amber-600 dark:text-amber-400">
            <Star
              className="h-4 w-4 fill-amber-400 text-amber-400"
              aria-hidden="true"
            />
            {supplier.rating.toFixed(1)} / 5
          </span>
        )}
        {supplier.tags.map((tag) => (
          <Badge key={tag} variant="info">
            {tag}
          </Badge>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-slate-100 dark:divide-slate-800">
                <DetailRow label="Contact person" value={supplier.contactPerson} />
                <DetailRow label="Mobile" value={supplier.mobile} />
                <DetailRow label="Email" value={supplier.email} />
                <DetailRow label="Website" value={supplier.website} />
                <DetailRow label="GST number" value={supplier.gstNumber} />
                <DetailRow label="PAN number" value={supplier.panNumber} />
                <DetailRow label="Address" value={address || null} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bank details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-slate-100 dark:divide-slate-800">
                <DetailRow
                  label="Account holder"
                  value={supplier.bankAccountName}
                />
                <DetailRow
                  label="Account number"
                  value={supplier.bankAccountNumber}
                />
                <DetailRow label="IFSC code" value={supplier.bankIfsc} />
                <DetailRow label="Bank name" value={supplier.bankName} />
                <DetailRow label="UPI ID" value={supplier.upiId} />
              </dl>
            </CardContent>
          </Card>

          {supplier.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                  {supplier.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payables</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Outstanding
                  </dt>
                  <dd className="nums mt-0.5 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    {currency.format(ledger.outstanding)}
                  </dd>
                </div>
                <DetailRow
                  label="Opening balance"
                  value={currency.format(ledger.openingBalance)}
                />
                <DetailRow
                  label="Payment terms"
                  value={`${supplier.paymentTermsDays} days`}
                />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Ledger</CardTitle>
              <Link
                href={`/suppliers/${supplier.id}/ledger`}
                className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              >
                View full ledger →
              </Link>
            </CardHeader>
            <CardContent>
              {ledger.entries.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No ledger entries yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {ledger.entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-slate-600 dark:text-slate-400">
                        {entry.description ?? entry.referenceType ?? "Entry"}
                      </span>
                      <span className="nums font-medium text-slate-900 dark:text-slate-100">
                        {currency.format(entry.runningBalance)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {showArchive && (
          <ArchiveDialog
            supplier={supplier}
            isPending={isArchiving}
            error={archiveError}
            onConfirm={handleArchiveConfirm}
            onCancel={() => {
              setShowArchive(false);
              setArchiveError(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
