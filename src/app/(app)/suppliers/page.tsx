import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { SupplierService } from "@/features/supplier/services/supplier.service";
import { ErrorState } from "@/components/shared/error-state";
import { SuppliersView } from "@/features/supplier/components/suppliers-view";

export const metadata: Metadata = {
  title: "Suppliers",
  description: "Manage your organization's suppliers",
};

export default async function SuppliersPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ org?: string }>;
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

  if (!context || !context.permissions.includes("supplier.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to view suppliers for this organization."
        />
      </div>
    );
  }

  const canManage =
    context.permissions.includes("supplier.create") ||
    context.permissions.includes("supplier.update");

  const service = new SupplierService(supabase);
  const result = await service.listSuppliers(activeOrg.id, { pageSize: 100 });

  return (
    <SuppliersView
      organizationId={activeOrg.id}
      suppliers={[...result.items]}
      canManage={canManage}
    />
  );
}
