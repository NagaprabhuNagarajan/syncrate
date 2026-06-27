import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { PurchaseReturnService } from "@/features/purchase/services/purchase-return.service";
import { ErrorState } from "@/components/shared/error-state";
import { PurchaseReturnsView } from "@/features/purchase/components/purchase-returns-view";
import type { PurchaseReturnStatus } from "@/features/purchase/types/purchase-return.types";

export const metadata: Metadata = {
  title: "Purchase returns",
  description: "Return goods to suppliers and reconcile stock",
};

const PRET_STATUSES: readonly PurchaseReturnStatus[] = [
  "draft",
  "completed",
  "cancelled",
];

function parseStatus(value?: string): PurchaseReturnStatus | undefined {
  if (value && PRET_STATUSES.includes(value as PurchaseReturnStatus)) {
    return value as PurchaseReturnStatus;
  }
  return undefined;
}

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function PurchaseReturnsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    org?: string;
    search?: string;
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

  if (!context || !context.permissions.includes("purchase.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to view purchase returns for this organization."
        />
      </div>
    );
  }

  const canManage = context.permissions.includes("purchase.create");

  const search = params.search?.trim() || undefined;
  const status = parseStatus(params.status);
  const page = parsePage(params.page);

  const service = new PurchaseReturnService(supabase);
  const result = await service.listPurchaseReturns(activeOrg.id, {
    search,
    status,
    page,
  });

  return (
    <PurchaseReturnsView
      organizationId={activeOrg.id}
      result={result}
      filters={{ search, status }}
      canManage={canManage}
    />
  );
}
