import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { InvoiceService } from "@/features/sales/services/invoice.service";
import { ErrorState } from "@/components/shared/error-state";
import { InvoiceShareActions } from "@/features/sales/components/invoice-share-actions";
import {
  InvoiceDocument,
  type InvoiceDocCustomer,
} from "@/features/sales/components/invoice-document";
import type { AppSupabaseClient } from "@/lib/supabase/types";

/**
 * Invoice share page — renders a clean, printable tax invoice with seller +
 * customer identity, GSTINs and payment status, plus print / PDF / copy-link
 * actions.
 *
 * Auth is still required for now. A truly public share link (Sprint 7 CBN)
 * will be implemented when the signed-URL token infrastructure is ready.
 */

async function lookupCustomer(
  supabase: AppSupabaseClient,
  id: string
): Promise<InvoiceDocCustomer | null> {
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

  return (
    <div className="min-h-screen bg-slate-100 p-4 dark:bg-slate-950 lg:p-8">
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
  }
  @page { margin: 14mm; }
}`,
        }}
      />
      <div className="mx-auto w-full max-w-4xl">
        {/* Action bar — hidden when printing */}
        <div className="mb-4 flex items-center justify-end">
          <InvoiceShareActions pdfUrl={`/api/invoices/${invoice.id}/pdf`} />
        </div>

        <InvoiceDocument
          org={context?.organization ?? null}
          orgFallbackName={activeOrg.name}
          customer={customer}
          invoice={invoice}
          productNames={productNames}
        />
      </div>
    </div>
  );
}
