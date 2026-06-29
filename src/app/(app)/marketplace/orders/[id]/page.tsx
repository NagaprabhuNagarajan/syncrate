import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { MarketplaceOrdersService } from "@/features/marketplace-orders/services/marketplace-orders.service";
import { getOrderRole } from "@/features/marketplace-orders/services/order-state";
import { ErrorState } from "@/components/shared/error-state";
import { OrderDetailView } from "@/features/marketplace-orders/components/order-detail-view";

export const metadata: Metadata = {
  title: "Order detail",
  description: "Marketplace order lifecycle and escrow payment",
};

export default async function MarketplaceOrderDetailPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
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

  const orgId = sp.org ?? organizations[0]?.id;
  const activeOrg =
    organizations.find((o) => o.id === orgId) ?? organizations[0];

  if (!activeOrg) {
    redirect("/create-organization");
  }

  const context = await orgService.getOrganizationContext(
    activeOrg.id,
    data.user.id
  );

  if (!context || !context.permissions.includes("marketplace.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You don't have permission to view marketplace orders. Contact an administrator if you believe this is a mistake."
        />
      </div>
    );
  }

  const service = new MarketplaceOrdersService(supabase);
  const result = await service.getOrderWithPayment(id);

  // RLS only returns rows the org participates in; double-check the guard.
  if (!result.success || getOrderRole(result.data.order, activeOrg.id) === null) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Order not found"
          message="This order doesn't exist or your organization is not a participant."
        />
      </div>
    );
  }

  const canTransact = context.permissions.includes("marketplace.order");

  return (
    <OrderDetailView
      organizationId={activeOrg.id}
      data={result.data}
      canTransact={canTransact}
    />
  );
}
