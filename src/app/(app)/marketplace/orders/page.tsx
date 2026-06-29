import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { MarketplaceOrdersService } from "@/features/marketplace-orders/services/marketplace-orders.service";
import { ErrorState } from "@/components/shared/error-state";
import { OrdersView } from "@/features/marketplace-orders/components/orders-view";
import type {
  OrderPerspective,
  OrderStatus,
} from "@/features/marketplace-orders/types/marketplace-orders.types";

export const metadata: Metadata = {
  title: "Orders",
  description: "Manage marketplace orders you place and receive",
};

function parsePerspective(value?: string): OrderPerspective {
  return value === "buying" || value === "selling" ? value : "all";
}

function parseStatus(value?: string): OrderStatus | undefined {
  return value === "pending" ||
    value === "confirmed" ||
    value === "cancelled" ||
    value === "fulfilled" ||
    value === "completed"
    ? value
    : undefined;
}

export default async function MarketplaceOrdersPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    org?: string;
    view?: string;
    status?: string;
    page?: string;
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

  const canTransact = context.permissions.includes("marketplace.order");
  const perspective = parsePerspective(params.view);
  const status = parseStatus(params.status);
  const pageNumber = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const service = new MarketplaceOrdersService(supabase);
  const result = await service.listOrders(activeOrg.id, {
    perspective,
    status,
    page: pageNumber,
  });

  return (
    <OrdersView
      organizationId={activeOrg.id}
      result={result}
      filters={{ perspective, status }}
      canTransact={canTransact}
    />
  );
}
