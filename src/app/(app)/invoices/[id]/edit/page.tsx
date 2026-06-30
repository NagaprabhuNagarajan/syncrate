import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { InvoiceService } from "@/features/sales/services/invoice.service";
import { ErrorState } from "@/components/shared/error-state";
import { InvoiceForm } from "@/features/sales/components/invoice-form";
import type { AppSupabaseClient } from "@/lib/supabase/types";

interface EditInvoicePageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}

export const metadata: Metadata = {
  title: "Edit invoice",
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

async function loadBranches(
  supabase: AppSupabaseClient,
  organizationId: string
) {
  const { data } = await supabase
    .from("branches")
    .select("id, name")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("name");
  return (data ?? []).map((r) => ({ id: r.id, name: r.name }));
}

export default async function EditInvoicePage({
  params,
  searchParams,
}: EditInvoicePageProps) {
  const { id } = await params;
  const query = await searchParams;
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

  const orgId = query.org ?? organizations[0]?.id;
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
          message="You do not have permission to edit invoices."
        />
      </div>
    );
  }

  const service = new InvoiceService(supabase);
  const result = await service.getInvoice(id);

  if (!result.success || result.data.organizationId !== activeOrg.id) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Invoice not found"
          message="This invoice does not exist or belongs to another organization."
        />
      </div>
    );
  }

  const invoice = result.data;

  // Only draft invoices can be edited
  if (invoice.status !== "draft") {
    redirect(`/invoices/${id}`);
  }

  const [customers, products, branches] = await Promise.all([
    loadCustomers(supabase, activeOrg.id),
    loadProducts(supabase, activeOrg.id),
    loadBranches(supabase, activeOrg.id),
  ]);

  const orgState = context.organization.state;

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <InvoiceForm
        organizationId={activeOrg.id}
        orgState={orgState}
        customers={customers}
        products={products}
        branches={branches}
        invoice={invoice}
      />
    </div>
  );
}
