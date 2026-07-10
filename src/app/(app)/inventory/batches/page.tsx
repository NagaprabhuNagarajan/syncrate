import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { BatchService } from "@/features/inventory/services/batch.service";
import { ErrorState } from "@/components/shared/error-state";
import { BatchesView } from "@/features/inventory/components/batches-view";
import type { ProductOption } from "@/features/inventory/types/inventory.types";

export const metadata: Metadata = {
  title: "Batches",
  description: "Track products by manufacturing batch and expiry",
};

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function BatchesPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    org?: string;
    product?: string;
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

  if (!context || !context.permissions.includes("inventory.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to view batches for this organization."
        />
      </div>
    );
  }

  const canManage = context.permissions.includes("inventory.adjust");
  const productId = params.product || undefined;
  const page = parsePage(params.page);

  const batchService = new BatchService(supabase);

  const [result, stats, productRows] = await Promise.all([
    batchService.listBatches(activeOrg.id, { productId, page }),
    batchService.getBatchStats(activeOrg.id),
    supabase
      .from("products")
      .select("id,name,code")
      .eq("organization_id", activeOrg.id)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .limit(500),
  ]);

  const products: ProductOption[] = (productRows.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
  }));

  return (
    <BatchesView
      organizationId={activeOrg.id}
      result={result}
      stats={stats}
      products={products}
      filters={{ productId }}
      canManage={canManage}
    />
  );
}
