import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { ErrorState } from "@/components/shared/error-state";
import { PurchaseInvoiceForm } from "@/features/purchase/components/purchase-invoice-form";
import { fetchPurchaseInvoiceOptions } from "@/features/purchase/server/purchase-invoice-options";

export const metadata: Metadata = {
  title: "New purchase invoice",
  description: "Record a supplier bill against your business",
};

export default async function NewPurchaseInvoicePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ org?: string; fromOcr?: string }>;
}) {
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

  if (!context || !context.permissions.includes("purchase.create")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to create purchase invoices for this organization."
        />
      </div>
    );
  }

  const options = await fetchPurchaseInvoiceOptions(supabase, activeOrg.id);

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto w-full max-w-5xl">
        <PurchaseInvoiceForm
          organizationId={activeOrg.id}
          suppliers={options.suppliers}
          products={options.products}
          fromOcr={query.fromOcr === "1"}
        />
      </div>
    </div>
  );
}
