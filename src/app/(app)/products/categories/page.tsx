import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { CategoryService } from "@/features/category/services/category.service";
import { ErrorState } from "@/components/shared/error-state";
import { CategoriesView } from "@/features/category/components/categories-view";
import type { CategoryStatus } from "@/features/category/types/category.types";

export const metadata: Metadata = {
  title: "Categories",
  description: "Organize your products into nested categories",
};

const CATEGORY_STATUSES: readonly CategoryStatus[] = ["active", "archived"];

function parseStatus(value?: string): CategoryStatus | undefined {
  if (value && CATEGORY_STATUSES.includes(value as CategoryStatus)) {
    return value as CategoryStatus;
  }
  return undefined;
}

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function CategoriesPage({
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
          message="You do not have permission to view categories for this organization."
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

  const categoryService = new CategoryService(supabase);
  const [result, allCategories] = await Promise.all([
    categoryService.listCategories(activeOrg.id, { search, status, page }),
    categoryService.listAllCategories(activeOrg.id),
  ]);

  return (
    <CategoriesView
      organizationId={activeOrg.id}
      result={result}
      allCategories={allCategories}
      filters={{ search, status }}
      canManage={canManage}
    />
  );
}
