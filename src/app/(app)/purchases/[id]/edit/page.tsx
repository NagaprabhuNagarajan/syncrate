import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { PurchaseOrderService } from "@/features/purchase/services/purchase-order.service";
import { ErrorState } from "@/components/shared/error-state";
import { PurchaseOrderForm } from "@/features/purchase/components/purchase-order-form";
import { fetchPurchaseOrderOptions } from "@/features/purchase/server/purchase-order-options";

export const metadata: Metadata = {
  title: "Edit purchase order",
  description: "Update the draft purchase order",
};

interface EditPurchaseOrderPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}

export default async function EditPurchaseOrderPage({
  params,
  searchParams,
}: EditPurchaseOrderPageProps) {
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
          message="You do not have permission to edit purchase orders for this organization."
        />
      </div>
    );
  }

  const service = new PurchaseOrderService(supabase);
  const result = await service.getPurchaseOrder(id);

  if (!result.success || result.data.organizationId !== activeOrg.id) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Purchase order not found"
          message="This purchase order does not exist or belongs to another organization."
        />
      </div>
    );
  }

  if (result.data.status !== "draft") {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Cannot edit this purchase order"
          message="Only draft purchase orders can be edited. This order has already been submitted."
        />
      </div>
    );
  }

  const options = await fetchPurchaseOrderOptions(supabase, activeOrg.id);

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto w-full max-w-5xl">
        <PurchaseOrderForm
          organizationId={activeOrg.id}
          purchaseOrder={result.data}
          suppliers={options.suppliers}
          branches={options.branches}
          products={options.products}
        />
      </div>
    </div>
  );
}
