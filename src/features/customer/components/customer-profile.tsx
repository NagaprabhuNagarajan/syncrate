"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Pencil,
  Archive,
  AlertTriangle,
  Mail,
  Phone,
  Globe,
  MapPin,
  ChevronLeft,
  Wallet,
  CreditCard,
  Landmark,
  CalendarClock,
  FileText,
  Hash,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { ErrorBanner } from "@/components/shared/error-banner";
import { KpiTile } from "@/components/shared/kpi-tile";
import { StatusBadge } from "@/components/shared/status-badge";
import { archiveCustomerAction } from "@/features/customer/actions/customer.actions";
import {
  STATUS_LABEL,
  STATUS_VARIANT,
} from "@/features/customer/utils/customer-display";
import { formatCurrency, formatDate } from "@/utils/format";
import type {
  Customer,
  CustomerLedger,
} from "@/features/customer/types/customer.types";

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
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {customerName}
              </span>
              ? Archived customers cannot receive new invoices.
            </p>
          </div>
        </div>

        {error && <ErrorBanner message={error} className="mt-4" />}

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
// Customer profile
// ─────────────────────────────────────────────────────────────

interface CustomerProfileProps {
  readonly customer: Customer;
  readonly ledger: CustomerLedger;
  readonly organizationId: string;
  readonly canManage: boolean;
  /** The customer's unallocated advance credit — shown when > 0. */
  readonly availableCredit?: number;
}

export function CustomerProfile({
  customer,
  ledger,
  organizationId,
  canManage,
  availableCredit = 0,
}: CustomerProfileProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showArchive, setShowArchive] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const org = searchParams.get("org");
  const withOrg = (path: string): string =>
    org ? `${path}${path.includes("?") ? "&" : "?"}org=${org}` : path;

  const editHref = withOrg(`/customers/${customer.id}/edit`);
  const ledgerHref = withOrg(`/customers/${customer.id}/ledger`);

  const formatAddress = (
    line1: string | null,
    line2: string | null,
    city: string | null,
    state: string | null,
    pincode: string | null
  ): string | null => {
    const value = [line1, line2, city, state, pincode]
      .filter(Boolean)
      .join(", ");
    return value || null;
  };

  const billingAddress = formatAddress(
    customer.billingAddressLine1,
    customer.billingAddressLine2,
    customer.billingCity,
    customer.billingState,
    customer.billingPincode
  );
  const shippingAddress = formatAddress(
    customer.shippingAddressLine1,
    customer.shippingAddressLine2,
    customer.shippingCity,
    customer.shippingState,
    customer.shippingPincode
  );

  const handleArchive = () => {
    setArchiveError(null);
    startTransition(async () => {
      const result = await archiveCustomerAction(organizationId, customer.id);
      if (!result.success) {
        setArchiveError(result.error.message);
        return;
      }
      setShowArchive(false);
      router.push(withOrg("/customers"));
    });
  };

  const outstandingPositive = ledger.outstanding > 0;

  return (
    <div className="p-4 lg:p-6">
      {/* Back link */}
      <Link
        href={withOrg("/customers")}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Customers
      </Link>

      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-4 mb-5 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/80 lg:-mx-6 lg:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {customer.name}
              </h1>
              <StatusBadge
                variant={STATUS_VARIANT[customer.status]}
                label={STATUS_LABEL[customer.status]}
              />
            </div>
            <p className="font-mono text-xs text-slate-400 dark:text-slate-500">
              {customer.code}
              {customer.company ? ` · ${customer.company}` : ""}
            </p>
          </div>

          {canManage && (
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={editHref}>
                  <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Edit
                </Link>
              </Button>
              {customer.status !== "archived" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
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
            </div>
          )}
        </div>

        {customer.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {customer.tags.map((tag) => (
              <Badge key={tag} variant="info" size="sm">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          icon={Wallet}
          label="Outstanding"
          value={ledger.outstanding}
          tint={
            outstandingPositive ? "bg-gradient-error" : "bg-gradient-success"
          }
          emphasis
          index={0}
        />
        <KpiTile
          icon={CreditCard}
          label="Credit limit"
          value={customer.creditLimit}
          tint="bg-gradient-brand"
          index={1}
        />
        <KpiTile
          icon={Landmark}
          label="Opening balance"
          value={customer.openingBalance}
          tint="bg-gradient-violet"
          index={2}
        />
        <KpiTile
          icon={CalendarClock}
          label="Payment terms"
          value={customer.paymentTermsDays}
          tint="bg-gradient-info"
          suffix="days"
          index={3}
        />
      </div>

      {/* Two-column body */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 lg:col-span-2">
          {customer.notes && (
            <SectionCard title="Notes" delay={0.1}>
              <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                {customer.notes}
              </p>
            </SectionCard>
          )}

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.15 }}
          >
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Ledger
                </h2>
                {ledger.entries.length > 0 && (
                  <Link
                    href={ledgerHref}
                    className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    View full ledger →
                  </Link>
                )}
              </div>
              {ledger.entries.length === 0 ? (
                <div className="px-5 pb-5">
                  <EmptyState
                    icon={FileText}
                    title="No ledger entries yet"
                    description="Ledger entries appear here once this customer has sales, payments or adjustments."
                  />
                </div>
              ) : (
                <Table
                  className="[&_td]:px-5 [&_th]:px-5"
                  wrapperClassName="rounded-none border-0 border-t border-slate-100 bg-transparent dark:border-slate-800"
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
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
                        <TableCell className="text-slate-700 dark:text-slate-300">
                          {entry.description ?? "—"}
                        </TableCell>
                        <TableCell className="nums text-right text-slate-700 dark:text-slate-300">
                          {formatCurrency(entry.debit, true)}
                        </TableCell>
                        <TableCell className="nums text-right text-slate-700 dark:text-slate-300">
                          {formatCurrency(entry.credit, true)}
                        </TableCell>
                        <TableCell className="nums text-right font-medium text-slate-900 dark:text-slate-100">
                          {formatCurrency(entry.runningBalance, true)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <SectionCard title="Contact" delay={0.1}>
            {customer.mobile ||
            customer.email ||
            customer.website ||
            customer.gstNumber ||
            customer.panNumber ||
            customer.preferredPaymentMethod ? (
              <dl className="space-y-4">
                <InfoRow icon={Phone} label="Mobile" value={customer.mobile} />
                <InfoRow icon={Mail} label="Email" value={customer.email} />
                <InfoRow
                  icon={Globe}
                  label="Website"
                  value={customer.website}
                />
                <InfoRow
                  icon={Hash}
                  label="GST number"
                  value={customer.gstNumber}
                />
                <InfoRow
                  icon={Hash}
                  label="PAN number"
                  value={customer.panNumber}
                />
                <InfoRow
                  icon={Wallet}
                  label="Preferred payment"
                  value={customer.preferredPaymentMethod}
                />
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                No contact details on file.
              </p>
            )}
          </SectionCard>

          <SectionCard title="Addresses" delay={0.15}>
            {billingAddress || shippingAddress ? (
              <dl className="space-y-4">
                <InfoRow
                  icon={MapPin}
                  label="Billing address"
                  value={billingAddress}
                />
                <InfoRow
                  icon={Building2}
                  label="Shipping address"
                  value={shippingAddress}
                />
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                No addresses on file.
              </p>
            )}
          </SectionCard>

          <SectionCard title="Details" delay={0.2}>
            <dl className="space-y-4">
              {availableCredit > 0 && (
                <InfoRow
                  icon={Wallet}
                  label="Available credit"
                  value={formatCurrency(availableCredit, true)}
                />
              )}
              <InfoRow
                icon={CalendarClock}
                label="Added on"
                value={formatDate(customer.createdAt)}
              />
              <InfoRow
                icon={CalendarClock}
                label="Last updated"
                value={formatDate(customer.updatedAt)}
              />
              <InfoRow
                icon={Landmark}
                label="Billing country"
                value={customer.billingCountry}
              />
            </dl>
          </SectionCard>
        </div>
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
