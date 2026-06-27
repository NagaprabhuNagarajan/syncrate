import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { ProductService } from "@/features/product/services/product.service";
import { ErrorState } from "@/components/shared/error-state";
import { ProductsView } from "@/features/product/components/products-view";
import type {
  ProductStatus,
  ProductType,
} from "@/features/product/types/product.types";

export const metadata: Metadata = {
  title: "Products",
  description: "Manage your product catalog, pricing and inventory",
};

const PRODUCT_STATUSES: readonly ProductStatus[] = [
  "draft",
  "active",
  "discontinued",
  "archived",
];

const PRODUCT_TYPES: readonly ProductType[] = [
  "inventory",
  "service",
  "digital",
  "bundle",
];

function parseStatus(value?: string): ProductStatus | undefined {
  if (value && PRODUCT_STATUSES.includes(value as ProductStatus)) {
    return value as ProductStatus;
  }
  return undefined;
}

function parseType(value?: string): ProductType | undefined {
  if (value && PRODUCT_TYPES.includes(value as ProductType)) {
    return value as ProductType;
  }
  return undefined;
}

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function ProductsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    org?: string;
    search?: string;
    status?: string;
    type?: string;
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
          message="You do not have permission to view products for this organization."
        />
      </div>
    );
  }

  const canManage =
    context.permissions.includes("product.create") ||
    context.permissions.includes("product.update");

  const search = params.search?.trim() || undefined;
  const status = parseStatus(params.status);
  const type = parseType(params.type);
  const page = parsePage(params.page);

  const productService = new ProductService(supabase);
  const result = await productService.listProducts(activeOrg.id, {
    search,
    status,
    type,
    page,
  });

  return (
    <ProductsView
      organizationId={activeOrg.id}
      result={result}
      filters={{ search, status, type }}
      canManage={canManage}
    />
  );
}
