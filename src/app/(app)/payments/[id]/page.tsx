import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Receipt } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { CustomerPaymentService } from "@/features/payment/services/customer-payment.service";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import type { PaymentMethod, PaymentStatus } from "@/features/payment/types/payment.types";

export const metadata: Metadata = {
  title: "Payment Details",
};

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

const STATUS_VARIANT: Record<PaymentStatus, BadgeProps["variant"]> = {
  completed: "success",
  voided: "destructive",
};

const currencyFmt = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatCurrency(value: number): string {
  return currencyFmt.format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-40 shrink-0 text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

export default async function PaymentDetailPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}) {
  const { id } = await params;
  const search = await searchParams;

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login");
  }

  const orgService = new OrganizationService(supabase);
  const organizations = await orgService.listUserOrganizations(data.user.id);

  if (organizations.length === 0) {
    redirect("/create-organization");
  }

  const orgId = search.org ?? organizations[0]?.id;
  const activeOrg =
    organizations.find((o) => o.id === orgId) ?? organizations[0];

  if (!activeOrg) {
    redirect("/create-organization");
  }

  const service = new CustomerPaymentService(supabase);
  const result = await service.getCustomerPayment(id);

  if (!result.success) {
    notFound();
  }

  const payment = result.data;

  return (
    <div className="p-6 lg:p-8">
      {/* Back */}
      <div className="mb-6">
        <Link
          href="/payments"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Payments
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
            <Receipt className="h-5 w-5 text-green-600" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              {payment.paymentNumber}
            </h1>
            <p className="text-sm text-slate-500">Customer Payment</p>
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[payment.status]} className="self-start sm:self-auto">
          {payment.status === "completed" ? "Completed" : "Voided"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Payment details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Payment Details
            </h2>
            <dl className="divide-y divide-slate-100">
              <DetailRow label="Payment Number" value={payment.paymentNumber} />
              <DetailRow label="Customer ID" value={payment.customerName ?? payment.customerId} />
              <DetailRow label="Payment Date" value={formatDate(payment.paymentDate)} />
              <DetailRow
                label="Amount"
                value={
                  <span className="text-lg font-bold text-slate-900">
                    {formatCurrency(payment.amount)}
                  </span>
                }
              />
              <DetailRow
                label="Method"
                value={METHOD_LABELS[payment.paymentMethod]}
              />
              {payment.referenceNumber && (
                <DetailRow
                  label="Reference No."
                  value={payment.referenceNumber}
                />
              )}
              {payment.notes && (
                <DetailRow label="Notes" value={payment.notes} />
              )}
            </dl>
          </div>

          {/* Allocations */}
          {payment.allocations.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Invoice Allocations
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Invoice ID
                      </th>
                      <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Allocated Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {payment.allocations.map((allocation) => (
                      <tr key={allocation.id}>
                        <td className="py-3 text-sm font-mono text-slate-700">
                          {allocation.invoiceId}
                        </td>
                        <td className="py-3 text-right text-sm font-semibold text-slate-900">
                          {formatCurrency(allocation.allocatedAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200">
                      <td className="pt-3 text-sm font-semibold text-slate-700">
                        Total Allocated
                      </td>
                      <td className="pt-3 text-right text-sm font-bold text-slate-900">
                        {formatCurrency(
                          payment.allocations.reduce(
                            (s, a) => s + a.allocatedAmount,
                            0
                          )
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Timeline
            </h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-slate-500">Created</dt>
                <dd className="mt-0.5 text-sm text-slate-700">
                  {formatDateTime(payment.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Last Updated</dt>
                <dd className="mt-0.5 text-sm text-slate-700">
                  {formatDateTime(payment.updatedAt)}
                </dd>
              </div>
              {payment.voidedAt && (
                <div>
                  <dt className="text-xs text-slate-500">Voided</dt>
                  <dd className="mt-0.5 text-sm text-red-600">
                    {formatDateTime(payment.voidedAt)}
                  </dd>
                </div>
              )}
              {payment.voidReason && (
                <div>
                  <dt className="text-xs text-slate-500">Void Reason</dt>
                  <dd className="mt-0.5 text-sm text-slate-700">
                    {payment.voidReason}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
