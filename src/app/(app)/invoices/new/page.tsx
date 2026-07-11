import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { SalesOrderService } from "@/features/sales/services/sales-order.service";
import { ErrorState } from "@/components/shared/error-state";
import { InvoiceForm } from "@/features/sales/components/invoice-form";
import type { InvoicePrefill } from "@/features/sales/components/invoice-form";
import type { AppSupabaseClient } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "New invoice",
  description: "Create a new sales invoice",
};

async function loadCustomers(
  supabase: AppSupabaseClient,
  organizationId: string
): Promise<
  {
    id: string;
    name: string;
    billingState: string | null;
    shippingState: string | null;
  }[]
> {
  const { data } = await supabase
    .from("customers")
    .select("id, name, billing_state, shipping_state")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("name");
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    billingState: r.billing_state ?? null,
    shippingState: r.shipping_state ?? null,
  }));
}

async function loadProducts(
  supabase: AppSupabaseClient,
  organizationId: string
): Promise<{ id: string; name: string; salePrice: number; gstRate: number }[]> {
  const { data } = await supabase
    .from("products")
    .select("id, name, selling_price, gst_rate")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("name");
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    salePrice: Number(r.selling_price ?? 0),
    gstRate: Number(r.gst_rate ?? 18),
  }));
}

async function loadBranches(
  supabase: AppSupabaseClient,
  organizationId: string
): Promise<{ id: string; name: string; state: string | null }[]> {
  const { data } = await supabase
    .from("branches")
    .select("id, name, state")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("name");
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    state: r.state ?? null,
  }));
}

export default async function NewInvoicePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ org?: string; from?: string; soId?: string }>;
}) {
  const params = await searchParams;
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

  const orgId = params.org ?? organizations[0]?.id;
  const activeOrg =
    organizations.find((o) => o.id === orgId) ?? organizations[0];

  if (!activeOrg) {
    redirect("/create-organization");
  }

  const context = await orgService.getOrganizationContext(
    activeOrg.id,
    data.user.id
  );

  if (!context || !context.permissions.includes("invoice.create")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to create invoices."
        />
      </div>
    );
  }

  const [customers, products, branches] = await Promise.all([
    loadCustomers(supabase, activeOrg.id),
    loadProducts(supabase, activeOrg.id),
    loadBranches(supabase, activeOrg.id),
  ]);

  const orgState = context.organization.state;

  // Prefill from a sales order when arriving via "Convert to invoice" on an SO.
  let prefill: InvoicePrefill | undefined;
  if (params.from === "so" && params.soId) {
    const soResult = await new SalesOrderService(supabase).getSalesOrder(
      params.soId
    );
    if (soResult.success && soResult.data.organizationId === activeOrg.id) {
      const so = soResult.data;
      prefill = {
        customerId: so.customerId,
        salesOrderId: so.id,
        salesOrderNumber: so.soNumber,
        branchId: so.branchId ?? "",
        supplyState: so.supplyState ?? "",
        isInterstate: so.isInterstate,
        items: so.items.map((item) => ({
          productId: item.productId,
          description: item.description ?? "",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          gstRate: item.gstRate,
        })),
      };
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <InvoiceForm
        organizationId={activeOrg.id}
        orgState={orgState}
        customers={customers}
        products={products}
        branches={branches}
        prefill={prefill}
      />
    </div>
  );
}
