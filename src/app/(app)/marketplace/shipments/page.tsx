import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { ShipmentService } from "@/features/marketplace-logistics/services/shipment.service";
import { ErrorState } from "@/components/shared/error-state";
import { ShipmentsView } from "@/features/marketplace-logistics/components/shipments-view";
import type { ShipmentStatus } from "@/features/marketplace-logistics/types/logistics.types";

export const metadata: Metadata = {
  title: "Shipments",
  description: "Track logistics for your marketplace orders",
};

function parseStatus(value?: string): ShipmentStatus | undefined {
  return value === "pending" ||
    value === "in_transit" ||
    value === "delivered" ||
    value === "cancelled"
    ? value
    : undefined;
}

export default async function ShipmentsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    org?: string;
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
          message="You don't have permission to view marketplace shipments. Contact an administrator if you believe this is a mistake."
        />
      </div>
    );
  }

  const canManage = context.permissions.includes("marketplace.order");
  const pageNumber = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const status = parseStatus(params.status);

  const service = new ShipmentService(supabase);
  const result = await service.listShipments(activeOrg.id, {
    status,
    page: pageNumber,
  });

  return (
    <ShipmentsView
      organizationId={activeOrg.id}
      result={result}
      filters={{ status }}
      canManage={canManage}
    />
  );
}
