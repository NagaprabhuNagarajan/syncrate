import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { InvoiceService } from "@/features/sales/services/invoice.service";
import { ErrorState } from "@/components/shared/error-state";
import { InvoiceShareActions } from "@/features/sales/components/invoice-share-actions";
import type { AppSupabaseClient } from "@/lib/supabase/types";

/**
 * Invoice share page — renders a clean, printable tax invoice with seller +
 * customer identity, GSTINs and payment status, plus print / PDF / copy-link
 * actions.
 *
 * Auth is still required for now. A truly public share link (Sprint 7 CBN)
 * will be implemented when the signed-URL token infrastructure is ready.
 */

interface ShareCustomer {
  readonly name: string;
  readonly gstNumber: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly pincode: string | null;
}

async function lookupCustomer(
  supabase: AppSupabaseClient,
  id: string
): Promise<ShareCustomer | null> {
  const { data } = await supabase
    .from("customers")
    .select(
      "name, gst_number, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_pincode"
    )
    .eq("id", id)
    .single();
  if (!data) {
    return null;
  }
  return {
    name: data.name,
    gstNumber: data.gst_number,
    addressLine1: data.billing_address_line1,
    addressLine2: data.billing_address_line2,
    city: data.billing_city,
    state: data.billing_state,
    pincode: data.billing_pincode,
  };
}

async function lookupProductNames(
  supabase: AppSupabaseClient,
  ids: readonly string[]
): Promise<Record<string, string>> {
  if (ids.length === 0) {
    return {};
  }
  const { data } = await supabase
    .from("products")
    .select("id,name")
    .in("id", [...new Set(ids)]);
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.id] = row.name;
  }
  return map;
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatDate(value: Date | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const PAYMENT_LABEL: Record<string, string> = {
  unpaid: "Unpaid",
  partial: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
};

/** Builds the printable address lines from optional parts, dropping blanks. */
function addressLines(parts: {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}): string[] {
  const cityLine = [parts.city, parts.state, parts.pincode]
    .filter(Boolean)
    .join(", ");
  return [parts.addressLine1, parts.addressLine2, cityLine || null].filter(
    (line): line is string => Boolean(line)
  );
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { title: "Invoice" };
  }
  const result = await new InvoiceService(supabase).getInvoice(id);
  // Drives the browser's print-header title — show the invoice number.
  return { title: result.success ? result.data.invoiceNumber : "Invoice" };
}

export default async function InvoiceSharePage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/login");
  }

  const orgService = new OrganizationService(supabase);
  const organizations = await orgService.listUserOrganizations(authData.user.id);

  if (organizations.length === 0) {
    redirect("/create-organization");
  }

  const service = new InvoiceService(supabase);
  const result = await service.getInvoice(id);

  if (!result.success) {
    return (
      <div className="p-6">
        <ErrorState
          title="Invoice not found"
          message="This invoice does not exist."
        />
      </div>
    );
  }

  const invoice = result.data;

  // Verify org membership
  const activeOrg = organizations.find((o) => o.id === invoice.organizationId);
  if (!activeOrg) {
    return (
      <div className="p-6">
        <ErrorState
          title="Access denied"
          message="You do not have access to this invoice."
        />
      </div>
    );
  }

  const [context, customer, productNames] = await Promise.all([
    orgService.getOrganizationContext(activeOrg.id, authData.user.id),
    lookupCustomer(supabase, invoice.customerId),
    lookupProductNames(
      supabase,
      invoice.items.map((item) => item.productId)
    ),
  ]);

  const org = context?.organization ?? null;
  const sellerLines = org
    ? addressLines({
        addressLine1: org.addressLine1,
        addressLine2: org.addressLine2,
        city: org.city,
        state: org.state,
        pincode: org.pincode,
      })
    : [];
  const buyerLines = customer ? addressLines(customer) : [];
  const balanceDue = invoice.totalAmount - invoice.amountPaid;

  return (
    <div className="min-h-screen bg-slate-50 p-4 dark:bg-slate-950 lg:p-8">
      {/* Print isolation: show ONLY the invoice document, never the app chrome. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
@media print {
  body * { visibility: hidden !important; }
  #invoice-document, #invoice-document * { visibility: visible !important; }
  #invoice-document {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    border: 0 !important;
    box-shadow: none !important;
  }
  /* Force a clean light rendering regardless of the viewer's theme */
  #invoice-document, #invoice-document * {
    color: #0f172a !important;
    background-color: transparent !important;
    border-color: #e2e8f0 !important;
  }
  #invoice-document { background-color: #ffffff !important; }
  @page { margin: 14mm; }
}`,
        }}
      />
      <div className="mx-auto w-full max-w-4xl">
        {/* Action bar — hidden when printing */}
        <div className="mb-4 flex items-center justify-end">
          <InvoiceShareActions pdfUrl={`/api/invoices/${invoice.id}/pdf`} />
        </div>

        {/* Invoice document */}
        <div
          id="invoice-document"
          className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border-0 print:shadow-none"
        >
          {/* Seller header */}
          <div className="flex flex-col gap-6 border-b border-slate-200 pb-6 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              {org?.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={org.logoUrl}
                  alt=""
                  className="h-12 w-12 rounded-lg object-contain"
                />
              )}
              <div>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {org?.displayName ?? org?.name ?? activeOrg.name}
                </p>
                {sellerLines.map((line) => (
                  <p
                    key={line}
                    className="text-sm text-slate-500 dark:text-slate-400"
                  >
                    {line}
                  </p>
                ))}
                {org?.gstNumber && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    GSTIN: <span className="font-medium">{org.gstNumber}</span>
                  </p>
                )}
                {(org?.phone || org?.email) && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {[org?.phone, org?.email].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>

            <div className="text-left sm:text-right">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {invoice.invoiceType.replace(/_/g, " ").toUpperCase()}
              </h1>
              <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                {invoice.invoiceNumber}
              </p>
              <dl className="mt-3 space-y-0.5 text-sm text-slate-500 dark:text-slate-400">
                <div className="flex justify-between gap-6 sm:justify-end">
                  <dt>Invoice date</dt>
                  <dd className="text-slate-700 dark:text-slate-300">
                    {formatDate(invoice.invoiceDate)}
                  </dd>
                </div>
                {invoice.dueDate && (
                  <div className="flex justify-between gap-6 sm:justify-end">
                    <dt>Due date</dt>
                    <dd className="text-slate-700 dark:text-slate-300">
                      {formatDate(invoice.dueDate)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-6 sm:justify-end">
                  <dt>Payment</dt>
                  <dd className="font-medium text-slate-700 dark:text-slate-300">
                    {PAYMENT_LABEL[invoice.paymentStatus] ??
                      invoice.paymentStatus}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Bill to + place of supply */}
          <div className="grid grid-cols-1 gap-6 py-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Bill to
              </p>
              <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                {customer?.name ?? "—"}
              </p>
              {buyerLines.map((line) => (
                <p
                  key={line}
                  className="text-sm text-slate-500 dark:text-slate-400"
                >
                  {line}
                </p>
              ))}
              {customer?.gstNumber && (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  GSTIN:{" "}
                  <span className="font-medium">{customer.gstNumber}</span>
                </p>
              )}
            </div>
            {invoice.supplyState && (
              <div className="sm:text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Place of supply
                </p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {invoice.supplyState}
                </p>
              </div>
            )}
          </div>

          {/* Line items */}
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Product
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  HSN
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">
                  Qty
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">
                  Rate
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">
                  Taxable
                </th>
                {invoice.isInterstate ? (
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    IGST
                  </th>
                ) : (
                  <>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">
                      CGST
                    </th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">
                      SGST
                    </th>
                  </>
                )}
                <th scope="col" className="py-2 text-right font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">
                    {productNames[item.productId] ?? item.description ?? "—"}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {item.hsnCode ?? "—"}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {item.quantity}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatCurrency(item.taxableAmount)}
                  </td>
                  {invoice.isInterstate ? (
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatCurrency(item.igstAmount)} ({item.igstRate}%)
                    </td>
                  ) : (
                    <>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {formatCurrency(item.cgstAmount)} ({item.cgstRate}%)
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {formatCurrency(item.sgstAmount)} ({item.sgstRate}%)
                      </td>
                    </>
                  )}
                  <td className="py-2 text-right font-medium tabular-nums">
                    {formatCurrency(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-6 flex justify-end">
            <dl className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">
                  Taxable value
                </dt>
                <dd className="tabular-nums">
                  {formatCurrency(invoice.subtotal - invoice.discountAmount)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Total GST</dt>
                <dd className="tabular-nums">
                  {formatCurrency(invoice.taxAmount)}
                </dd>
              </div>
              {invoice.roundOff !== 0 && (
                <div className="flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">
                    Round off
                  </dt>
                  <dd className="tabular-nums">
                    {invoice.roundOff > 0 ? "+" : ""}
                    {formatCurrency(invoice.roundOff)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold dark:border-slate-800">
                <dt>Grand total</dt>
                <dd className="tabular-nums">
                  {formatCurrency(invoice.totalAmount)}
                </dd>
              </div>
              {invoice.amountPaid > 0 && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-slate-500 dark:text-slate-400">
                      Amount paid
                    </dt>
                    <dd className="tabular-nums">
                      −{formatCurrency(invoice.amountPaid)}
                    </dd>
                  </div>
                  <div className="flex justify-between font-semibold text-slate-900 dark:text-slate-100">
                    <dt>Balance due</dt>
                    <dd className="tabular-nums">{formatCurrency(balanceDue)}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          {/* Notes / Terms */}
          {(invoice.notes || invoice.terms) && (
            <div className="mt-8 space-y-4 border-t border-slate-200 pt-6 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
              {invoice.notes && (
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    Notes
                  </p>
                  <p className="mt-1 whitespace-pre-line">{invoice.notes}</p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    Terms &amp; conditions
                  </p>
                  <p className="mt-1 whitespace-pre-line">{invoice.terms}</p>
                </div>
              )}
            </div>
          )}

          <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
            Thank you for your business!
          </p>
        </div>
      </div>
    </div>
  );
}
