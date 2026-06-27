import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { InvoiceService } from "@/features/sales/services/invoice.service";
import { ErrorState } from "@/components/shared/error-state";
import type { AppSupabaseClient } from "@/lib/supabase/types";

/**
 * Invoice share page — renders a clean, printable invoice.
 *
 * Auth is still required for now. A truly public share link (Sprint 7 CBN)
 * will be implemented when the signed-URL token infrastructure is ready.
 */

async function lookupCustomerName(
  supabase: AppSupabaseClient,
  id: string
): Promise<string | null> {
  const { data } = await supabase
    .from("customers")
    .select("name")
    .eq("id", id)
    .single();
  return data?.name ?? null;
}

async function lookupProductNames(
  supabase: AppSupabaseClient,
  ids: readonly string[]
): Promise<Record<string, string>> {
  if (ids.length === 0) {return {};}
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
  if (!value) {return "—";}
  return new Date(value).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
  const activeOrg = organizations.find(
    (o) => o.id === invoice.organizationId
  );
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

  const [customerName, productNames] = await Promise.all([
    lookupCustomerName(supabase, invoice.customerId),
    lookupProductNames(
      supabase,
      invoice.items.map((item) => item.productId)
    ),
  ]);

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="mx-auto max-w-4xl">
        {/* Invoice header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {invoice.invoiceNumber}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {invoice.invoiceType.replace(/_/g, " ").toUpperCase()}
            </p>
          </div>
          <div className="text-right text-sm text-slate-600">
            <p className="font-semibold text-slate-900">{activeOrg.name}</p>
            <p className="mt-1">Invoice date: {formatDate(invoice.invoiceDate)}</p>
            {invoice.dueDate && (
              <p>Due date: {formatDate(invoice.dueDate)}</p>
            )}
          </div>
        </div>

        {/* Customer info */}
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Bill to
          </p>
          <p className="mt-1 font-semibold text-slate-900">
            {customerName ?? "—"}
          </p>
        </div>

        {/* Line items */}
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="py-2 pr-4 font-medium">Product</th>
              <th scope="col" className="py-2 pr-4 font-medium">HSN</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Qty</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Rate</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Taxable</th>
              {invoice.isInterstate ? (
                <th scope="col" className="py-2 pr-4 text-right font-medium">IGST</th>
              ) : (
                <>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">CGST</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">SGST</th>
                </>
              )}
              <th scope="col" className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td className="py-2 pr-4 text-slate-700">
                  {productNames[item.productId] ?? item.description ?? "—"}
                </td>
                <td className="py-2 pr-4 font-mono text-xs text-slate-500">
                  {item.hsnCode ?? "—"}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">{item.quantity}</td>
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
                <td className="py-2 text-right tabular-nums font-medium">
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
              <dt className="text-slate-500">Taxable value</dt>
              <dd className="tabular-nums">
                {formatCurrency(invoice.subtotal - invoice.discountAmount)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Total GST</dt>
              <dd className="tabular-nums">{formatCurrency(invoice.taxAmount)}</dd>
            </div>
            {invoice.roundOff !== 0 && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Round off</dt>
                <dd className="tabular-nums">
                  {invoice.roundOff > 0 ? "+" : ""}
                  {formatCurrency(invoice.roundOff)}
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
              <dt>Grand total</dt>
              <dd className="tabular-nums">{formatCurrency(invoice.totalAmount)}</dd>
            </div>
          </dl>
        </div>

        {/* Notes / Terms */}
        {(invoice.notes || invoice.terms) && (
          <div className="mt-8 space-y-4 border-t border-slate-200 pt-6 text-sm text-slate-600">
            {invoice.notes && (
              <div>
                <p className="font-semibold text-slate-800">Notes</p>
                <p className="mt-1 whitespace-pre-line">{invoice.notes}</p>
              </div>
            )}
            {invoice.terms && (
              <div>
                <p className="font-semibold text-slate-800">Terms &amp; conditions</p>
                <p className="mt-1 whitespace-pre-line">{invoice.terms}</p>
              </div>
            )}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          Thank you for your business!
        </p>
      </div>
    </div>
  );
}
