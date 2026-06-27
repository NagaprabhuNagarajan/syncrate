import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { QuotationService } from "@/features/sales/services/quotation.service";
import { ErrorState } from "@/components/shared/error-state";
import { QuotationDetail } from "@/features/sales/components/quotation-detail";
import type { AppSupabaseClient } from "@/lib/supabase/types";

interface QuotationDetailPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}

export async function generateMetadata({
  params,
}: QuotationDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {return { title: "Quotation" };}
  const result = await new QuotationService(supabase).getQuotation(id);
  return { title: result.success ? result.data.quotationNumber : "Quotation" };
}

async function lookupName(
  supabase: AppSupabaseClient,
  table: "customers" | "warehouses",
  id: string | null
): Promise<string | null> {
  if (!id) {return null;}
  const { data } = await supabase
    .from(table)
    .select("name")
    .eq("id", id)
    .single();
  return data?.name ?? null;
}

async function lookupProductNames(
  supabase: AppSupabaseClient,
  ids: readonly string[]
): Promise<Record<string, string>> {
  if (ids.length === 0) {return {};}
  const { data } = await supabase
    .from("products")
    .select("id,name")
    .in("id", [...new Set(ids)]);
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.id] = row.name;
  }
  return map;
}

export default async function QuotationDetailPage({
  params,
  searchParams,
}: QuotationDetailPageProps) {
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

  if (!context || !context.permissions.includes("sales.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to view quotations for this organization."
        />
      </div>
    );
  }

  const service = new QuotationService(supabase);
  const result = await service.getQuotation(id);

  if (!result.success || result.data.organizationId !== activeOrg.id) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Quotation not found"
          message="This quotation does not exist or belongs to another organization."
        />
      </div>
    );
  }

  const quotation = result.data;

  const [customerName, productNames] = await Promise.all([
    lookupName(supabase, "customers", quotation.customerId),
    lookupProductNames(
      supabase,
      quotation.items.map((item) => item.productId)
    ),
  ]);

  return (
    <QuotationDetail
      quotation={quotation}
      customerName={customerName}
      productNames={productNames}
      organizationId={activeOrg.id}
      canManage={context.permissions.includes("sales.create")}
      canApprove={context.permissions.includes("sales.approve")}
      canCancel={context.permissions.includes("sales.cancel")}
    />
  );
}
