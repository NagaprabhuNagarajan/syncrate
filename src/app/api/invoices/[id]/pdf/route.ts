import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { InvoiceService } from "@/features/sales/services/invoice.service";
import { OrganizationService } from "@/features/organization/services/organization.service";

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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const autoPrint = request.nextUrl.searchParams.get("auto") === "true";

  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgService = new OrganizationService(supabase);
  const organizations = await orgService.listUserOrganizations(authData.user.id);

  if (organizations.length === 0) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const invoiceService = new InvoiceService(supabase);
  const result = await invoiceService.getInvoice(id);

  if (!result.success) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const invoice = result.data;

  // Verify org access
  const activeOrg = organizations.find(
    (o) => o.id === invoice.organizationId
  );
  if (!activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch customer name and product names
  const { data: customerData } = await supabase
    .from("customers")
    .select(
      "name, billing_address_line1, billing_city, billing_state, billing_pincode, gst_number"
    )
    .eq("id", invoice.customerId)
    .single();

  const productIds = [...new Set(invoice.items.map((i) => i.productId))];
  const { data: products } = await supabase
    .from("products")
    .select("id, name")
    .in("id", productIds);

  const productMap: Record<string, string> = {};
  for (const row of products ?? []) {
    productMap[row.id] = row.name;
  }

  const customerName = escapeHtml(customerData?.name ?? "");
  const orgName = escapeHtml(activeOrg.name);
  const itemsHtml = invoice.items
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(productMap[item.productId] ?? item.description ?? "—")}</td>
        <td>${escapeHtml(item.hsnCode ?? "—")}</td>
        <td class="right">${item.quantity}</td>
        <td class="right">${formatCurrency(item.unitPrice)}</td>
        ${item.discountPercent > 0 ? `<td class="right">${item.discountPercent}%</td>` : `<td class="right">—</td>`}
        <td class="right">${formatCurrency(item.taxableAmount)}</td>
        ${
          invoice.isInterstate
            ? `<td class="right">${formatCurrency(item.igstAmount)} (${item.igstRate}%)</td>`
            : `<td class="right">${formatCurrency(item.cgstAmount)} (${item.cgstRate}%)</td>
               <td class="right">${formatCurrency(item.sgstAmount)} (${item.sgstRate}%)</td>`
        }
        <td class="right bold">${formatCurrency(item.lineTotal)}</td>
      </tr>`
    )
    .join("");

  const gstColHeaders = invoice.isInterstate
    ? `<th class="right">IGST</th>`
    : `<th class="right">CGST</th><th class="right">SGST</th>`;

  const totalsHtml = `
    <tr><td colspan="2" class="label">Taxable value</td><td class="right">${formatCurrency(invoice.subtotal - invoice.discountAmount)}</td></tr>
    ${
      invoice.isInterstate
        ? `<tr><td colspan="2" class="label">IGST</td><td class="right">${formatCurrency(invoice.igstAmount)}</td></tr>`
        : `<tr><td colspan="2" class="label">CGST</td><td class="right">${formatCurrency(invoice.cgstAmount)}</td></tr>
           <tr><td colspan="2" class="label">SGST</td><td class="right">${formatCurrency(invoice.sgstAmount)}</td></tr>`
    }
    <tr><td colspan="2" class="label">Total GST</td><td class="right">${formatCurrency(invoice.taxAmount)}</td></tr>
    ${
      invoice.roundOff !== 0
        ? `<tr><td colspan="2" class="label">Round off</td><td class="right">${invoice.roundOff > 0 ? "+" : ""}${formatCurrency(invoice.roundOff)}</td></tr>`
        : ""
    }
    <tr class="grand-total"><td colspan="2" class="label">GRAND TOTAL</td><td class="right">${formatCurrency(invoice.totalAmount)}</td></tr>
  `;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(invoice.invoiceNumber)} — ${orgName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 12px;
      color: #1e293b;
      background: white;
      padding: 40px;
    }
    h1 { font-size: 22px; font-weight: 700; }
    h2 { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
    .org-name { font-size: 18px; font-weight: 700; color: #2563eb; }
    .invoice-meta { text-align: right; }
    .invoice-meta p { margin-bottom: 4px; color: #475569; }
    .invoice-meta .inv-number { font-size: 16px; font-weight: 700; color: #1e293b; }
    .section { margin-bottom: 24px; }
    .customer-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f1f5f9; padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 2px solid #e2e8f0; }
    td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
    .right { text-align: right; }
    .bold { font-weight: 600; }
    .totals-table td { border-bottom: none; }
    .totals-table tr:last-child td { border-top: 2px solid #1e293b; padding-top: 12px; }
    .label { color: #64748b; }
    .grand-total td { font-size: 14px; font-weight: 700; }
    .notes { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
    .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 10px; }
    @media print {
      body { padding: 20px; }
      @page { margin: 20mm; size: A4; }
      .no-print { display: none; }
      table { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="org-name">${orgName}</div>
    </div>
    <div class="invoice-meta">
      <p class="inv-number">${escapeHtml(invoice.invoiceNumber)}</p>
      <p>${escapeHtml(invoice.invoiceType.replace(/_/g, " ").toUpperCase())}</p>
      <p>Invoice date: ${formatDate(invoice.invoiceDate)}</p>
      ${invoice.dueDate ? `<p>Due date: ${formatDate(invoice.dueDate)}</p>` : ""}
    </div>
  </div>

  <div class="section customer-box">
    <h2>Bill to</h2>
    <p><strong>${customerName}</strong></p>
    ${customerData?.billing_address_line1 ? `<p>${escapeHtml(customerData.billing_address_line1)}</p>` : ""}
    ${customerData?.billing_city ? `<p>${escapeHtml(customerData.billing_city)}${customerData.billing_state ? `, ${escapeHtml(customerData.billing_state)}` : ""}${customerData.billing_pincode ? ` — ${escapeHtml(customerData.billing_pincode)}` : ""}</p>` : ""}
    ${customerData?.gst_number ? `<p>GSTIN: ${escapeHtml(customerData.gst_number)}</p>` : ""}
  </div>

  <div class="section">
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>HSN</th>
          <th class="right">Qty</th>
          <th class="right">Rate</th>
          <th class="right">Disc</th>
          <th class="right">Taxable</th>
          ${gstColHeaders}
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
  </div>

  <div style="display:flex;justify-content:flex-end">
    <table class="totals-table" style="width:300px">
      <tbody>${totalsHtml}</tbody>
    </table>
  </div>

  ${
    invoice.notes
      ? `<div class="notes"><h2>Notes</h2><p>${escapeHtml(invoice.notes)}</p></div>`
      : ""
  }
  ${
    invoice.terms
      ? `<div class="notes"><h2>Terms &amp; conditions</h2><p>${escapeHtml(invoice.terms)}</p></div>`
      : ""
  }

  <div class="footer">Thank you for your business!</div>

  ${autoPrint ? `<script>window.addEventListener('load', function() { window.print(); });<\/script>` : ""}
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-cache",
    },
  });
}
