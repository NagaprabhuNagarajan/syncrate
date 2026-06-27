import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { ErrorState } from "@/components/shared/error-state";
import { PurchaseReturnForm } from "@/features/purchase/components/purchase-return-form";
import { fetchPurchaseReturnOptions } from "@/features/purchase/server/purchase-return-options";

export const metadata: Metadata = {
  title: "New purchase return",
  description: "Return goods to one of your suppliers",
};

export default async function NewPurchaseReturnPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ org?: string }>;
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
          message="You do not have permission to create purchase returns for this organization."
        />
      </div>
    );
  }

  const options = await fetchPurchaseReturnOptions(supabase, activeOrg.id);

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto w-full max-w-5xl">
        <PurchaseReturnForm
          organizationId={activeOrg.id}
          suppliers={options.suppliers}
          warehouses={options.warehouses}
          products={options.products}
        />
      </div>
    </div>
  );
}
