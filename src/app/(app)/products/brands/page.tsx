import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { BrandService } from "@/features/brand/services/brand.service";
import { ErrorState } from "@/components/shared/error-state";
import { BrandsView } from "@/features/brand/components/brands-view";
import type { BrandStatus } from "@/features/brand/types/brand.types";

export const metadata: Metadata = {
  title: "Brands",
  description: "Manage the brands in your product catalog",
};

const BRAND_STATUSES: readonly BrandStatus[] = ["active", "archived"];

function parseStatus(value?: string): BrandStatus | undefined {
  if (value && BRAND_STATUSES.includes(value as BrandStatus)) {
    return value as BrandStatus;
  }
  return undefined;
}

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function BrandsPage({
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

  if (!context || !context.permissions.includes("product.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to view brands for this organization."
        />
      </div>
    );
  }

  const canManage =
    context.permissions.includes("product.create") ||
    context.permissions.includes("product.update");

  const search = params.search?.trim() || undefined;
  const status = parseStatus(params.status);
  const page = parsePage(params.page);

  const brandService = new BrandService(supabase);
  const result = await brandService.listBrands(activeOrg.id, {
    search,
    status,
    page,
  });

  return (
    <BrandsView
      organizationId={activeOrg.id}
      result={result}
      filters={{ search, status }}
      canManage={canManage}
    />
  );
}
