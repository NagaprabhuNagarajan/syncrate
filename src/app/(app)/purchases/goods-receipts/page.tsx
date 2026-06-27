import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { GoodsReceiptService } from "@/features/purchase/services/goods-receipt.service";
import { ErrorState } from "@/components/shared/error-state";
import { GoodsReceiptsView } from "@/features/purchase/components/goods-receipts-view";

export const metadata: Metadata = {
  title: "Goods receipts",
  description: "Deliveries recorded against your purchase orders",
};

interface GoodsReceiptsPageProps {
  readonly searchParams: Promise<{
    org?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function GoodsReceiptsPage({
  searchParams,
}: GoodsReceiptsPageProps) {
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

  if (!context || !context.permissions.includes("purchase.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to view goods receipts for this organization."
        />
      </div>
    );
  }

  const search = query.search?.trim() || undefined;
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);

  const service = new GoodsReceiptService(supabase);
  const result = await service.listGoodsReceipts(activeOrg.id, { search, page });

  return (
    <GoodsReceiptsView
      organizationId={activeOrg.id}
      result={result}
      filters={{ search }}
    />
  );
}
