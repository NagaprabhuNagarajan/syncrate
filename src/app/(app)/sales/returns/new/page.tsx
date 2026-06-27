import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { ErrorState } from "@/components/shared/error-state";
import { SalesReturnForm } from "@/features/sales/components/sales-return-form";
import type { AppSupabaseClient } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "New sales return",
  description: "Record goods returned by a customer",
};

async function loadCustomers(
  supabase: AppSupabaseClient,
  organizationId: string
) {
  const { data } = await supabase
    .from("customers")
    .select("id, name")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("name");
  return (data ?? []).map((r) => ({ id: r.id, name: r.name }));
}

async function loadProducts(
  supabase: AppSupabaseClient,
  organizationId: string
) {
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

async function loadWarehouses(
  supabase: AppSupabaseClient,
  organizationId: string
) {
  const { data } = await supabase
    .from("warehouses")
    .select("id, name")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("name");
  return (data ?? []).map((r) => ({ id: r.id, name: r.name }));
}

export default async function NewSalesReturnPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    org?: string;
    invoiceId?: string;
    customerId?: string;
  }>;
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

  if (!context || !context.permissions.includes("sales.create")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to create sales returns."
        />
      </div>
    );
  }

  const [customers, products, warehouses] = await Promise.all([
    loadCustomers(supabase, activeOrg.id),
    loadProducts(supabase, activeOrg.id),
    loadWarehouses(supabase, activeOrg.id),
  ]);

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <SalesReturnForm
        organizationId={activeOrg.id}
        customers={customers}
        products={products}
        warehouses={warehouses}
        defaultInvoiceId={params.invoiceId}
        defaultCustomerId={params.customerId}
      />
    </div>
  );
}
