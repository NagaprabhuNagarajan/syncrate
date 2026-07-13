import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { BillService } from "@/features/purchase/services/bill.service";
import { ErrorState } from "@/components/shared/error-state";
import { BillForm } from "@/features/purchase/components/bill-form";
import { fetchBillOptions } from "@/features/purchase/server/bill-options";

export const metadata: Metadata = {
  title: "Edit bill",
  description: "Update a draft supplier bill",
};

interface EditBillPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}

export default async function EditBillPage({
  params,
  searchParams,
}: EditBillPageProps) {
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

  if (!context || !context.permissions.includes("purchase.create")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to edit bills for this organization."
        />
      </div>
    );
  }

  const service = new BillService(supabase);
  const result = await service.getBill(id);

  if (!result.success || result.data.organizationId !== activeOrg.id) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Bill not found"
          message="This bill does not exist or belongs to another organization."
        />
      </div>
    );
  }

  // Only draft bills can be edited; posted/cancelled bills are immutable.
  if (result.data.status !== "draft") {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Bill cannot be edited"
          message="Only draft bills can be edited. This bill has already been posted or cancelled."
        />
      </div>
    );
  }

  const options = await fetchBillOptions(supabase, activeOrg.id);

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto w-full max-w-5xl">
        <BillForm
          organizationId={activeOrg.id}
          suppliers={options.suppliers}
          products={options.products}
          bill={result.data}
        />
      </div>
    </div>
  );
}
