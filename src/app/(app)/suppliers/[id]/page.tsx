import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { SupplierService } from "@/features/supplier/services/supplier.service";
import { ErrorState } from "@/components/shared/error-state";
import { SupplierProfile } from "@/features/supplier/components/supplier-profile";

export const metadata: Metadata = {
  title: "Supplier",
  description: "Supplier details",
};

export default async function SupplierDetailPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}) {
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

  const service = new SupplierService(supabase);
  const result = await service.getSupplier(id);

  if (!result.success || result.data.organizationId !== activeOrg.id) {
    notFound();
  }

  const ledger = await service.getSupplierLedger(result.data);

  return (
    <SupplierProfile
      organizationId={activeOrg.id}
      supplier={result.data}
      ledger={ledger}
    />
  );
}
