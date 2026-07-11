import type { InvoiceWithItems } from "@/features/sales/types/invoice.types";

export interface InvoiceDocOrg {
  readonly name: string;
  readonly displayName: string | null;
  readonly gstNumber: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly pincode: string | null;
  readonly logoUrl: string | null;
}

export interface InvoiceDocCustomer {
  readonly name: string;
  readonly gstNumber: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly pincode: string | null;
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

interface InvoiceDocumentProps {
  readonly org: InvoiceDocOrg | null;
  readonly orgFallbackName: string;
  readonly customer: InvoiceDocCustomer | null;
  readonly invoice: InvoiceWithItems;
  readonly productNames: Readonly<Record<string, string>>;
}

/**
 * The printable invoice document — a self-contained tax invoice used by both
 * the /share page and the server-side PDF renderer. Kept free of app chrome so
 * it can be lifted onto its own page for print / PDF.
 */
export function InvoiceDocument({
  org,
  orgFallbackName,
  customer,
  invoice,
  productNames,
}: InvoiceDocumentProps) {
  const sellerLines = org ? addressLines(org) : [];
  const buyerLines = customer ? addressLines(customer) : [];
  const balanceDue = invoice.totalAmount - invoice.amountPaid;

  return (
    <div
      id="invoice-document"
      className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-900 shadow-sm print:rounded-none print:border-0 print:shadow-none"
    >
      {/* Seller header */}
      <div className="flex flex-col gap-6 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
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
            <p className="text-lg font-bold text-slate-900">
              {org?.displayName ?? org?.name ?? orgFallbackName}
            </p>
            {sellerLines.map((line) => (
              <p key={line} className="text-sm text-slate-500">
                {line}
              </p>
            ))}
            {org?.gstNumber && (
              <p className="mt-1 text-sm text-slate-600">
                GSTIN: <span className="font-medium">{org.gstNumber}</span>
              </p>
            )}
            {(org?.phone || org?.email) && (
              <p className="text-sm text-slate-500">
                {[org?.phone, org?.email].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>

        <div className="text-left sm:text-right">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {invoice.invoiceType.replace(/_/g, " ").toUpperCase()}
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            {invoice.invoiceNumber}
          </p>
          <dl className="mt-3 space-y-0.5 text-sm text-slate-500">
            <div className="flex justify-between gap-6 sm:justify-end">
              <dt>Invoice date</dt>
              <dd className="text-slate-700">
                {formatDate(invoice.invoiceDate)}
              </dd>
            </div>
            {invoice.dueDate && (
              <div className="flex justify-between gap-6 sm:justify-end">
                <dt>Due date</dt>
                <dd className="text-slate-700">
                  {formatDate(invoice.dueDate)}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-6 sm:justify-end">
              <dt>Payment</dt>
              <dd className="font-medium text-slate-700">
                {PAYMENT_LABEL[invoice.paymentStatus] ?? invoice.paymentStatus}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Bill to + place of supply */}
      <div className="grid grid-cols-1 gap-6 py-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Bill to
          </p>
          <p className="mt-1 font-semibold text-slate-900">
            {customer?.name ?? "—"}
          </p>
          {buyerLines.map((line) => (
            <p key={line} className="text-sm text-slate-500">
              {line}
            </p>
          ))}
          {customer?.gstNumber && (
            <p className="mt-1 text-sm text-slate-600">
              GSTIN: <span className="font-medium">{customer.gstNumber}</span>
            </p>
          )}
        </div>
        {invoice.supplyState && (
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Place of supply
            </p>
            <p className="mt-1 text-sm text-slate-700">{invoice.supplyState}</p>
          </div>
        )}
      </div>

      {/* Line items */}
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
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
        <tbody className="divide-y divide-slate-100">
          {invoice.items.map((item) => (
            <tr key={item.id} className="break-inside-avoid">
              <td className="py-2 pr-4 text-slate-700">
                {productNames[item.productId] ?? item.description ?? "—"}
              </td>
              <td className="py-2 pr-4 font-mono text-xs text-slate-500">
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

      {/* Totals — kept together across page breaks */}
      <div className="mt-6 flex break-inside-avoid justify-end">
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
            <dd className="tabular-nums">
              {formatCurrency(invoice.totalAmount)}
            </dd>
          </div>
          {invoice.amountPaid > 0 && (
            <>
              <div className="flex justify-between">
                <dt className="text-slate-500">Amount paid</dt>
                <dd className="tabular-nums">
                  −{formatCurrency(invoice.amountPaid)}
                </dd>
              </div>
              <div className="flex justify-between font-semibold text-slate-900">
                <dt>Balance due</dt>
                <dd className="tabular-nums">{formatCurrency(balanceDue)}</dd>
              </div>
            </>
          )}
        </dl>
      </div>

      {/* Notes / Terms */}
      {(invoice.notes || invoice.terms) && (
        <div className="mt-8 space-y-4 border-t border-slate-200 pt-6 text-sm text-slate-600">
          {invoice.notes && (
            <div className="break-inside-avoid">
              <p className="font-semibold text-slate-800">Notes</p>
              <p className="mt-1 whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}
          {invoice.terms && (
            <div className="break-inside-avoid">
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
  );
}

InvoiceDocument.displayName = "InvoiceDocument";
