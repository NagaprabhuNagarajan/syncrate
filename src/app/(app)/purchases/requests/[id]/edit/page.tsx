import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { PurchaseRequestService } from "@/features/purchase/services/purchase-request.service";
import { ErrorState } from "@/components/shared/error-state";
import { PurchaseRequestForm } from "@/features/purchase/components/purchase-request-form";
import { fetchPurchaseRequestOptions } from "@/features/purchase/server/purchase-request-options";

export const metadata: Metadata = {
  title: "Edit purchase request",
  description: "Update the draft requisition",
};

interface EditPurchaseRequestPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}

export default async function EditPurchaseRequestPage({
  params,
  searchParams,
}: EditPurchaseRequestPageProps) {
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
          message="You do not have permission to edit purchase requests for this organization."
        />
      </div>
    );
  }

  const service = new PurchaseRequestService(supabase);
  const result = await service.getPurchaseRequest(id);

  if (!result.success || result.data.organizationId !== activeOrg.id) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Purchase request not found"
          message="This purchase request does not exist or belongs to another organization."
        />
      </div>
    );
  }

  if (result.data.status !== "draft") {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Cannot edit this purchase request"
          message="Only draft purchase requests can be edited. This request has already been submitted."
        />
      </div>
    );
  }

  const options = await fetchPurchaseRequestOptions(supabase, activeOrg.id);

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto w-full max-w-5xl">
        <PurchaseRequestForm
          organizationId={activeOrg.id}
          purchaseRequest={result.data}
          warehouses={options.warehouses}
          products={options.products}
        />
      </div>
    </div>
  );
}
