import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { ProductService } from "@/features/product/services/product.service";
import { ErrorState } from "@/components/shared/error-state";
import { ProductProfile } from "@/features/product/components/product-profile";
import { fetchProductOptions } from "@/features/product/server/product-options";

interface ProductDetailPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { title: "Product" };
  }
  const result = await new ProductService(supabase).getProduct(id);
  return {
    title: result.success ? result.data.name : "Product",
  };
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: ProductDetailPageProps) {
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

  const productService = new ProductService(supabase);
  const result = await productService.getProduct(id);

  if (!result.success || result.data.organizationId !== activeOrg.id) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Product not found"
          message="This product does not exist or belongs to another organization."
        />
      </div>
    );
  }

  const canManage =
    context.permissions.includes("product.update") ||
    context.permissions.includes("product.delete");

  const options = await fetchProductOptions(supabase, activeOrg.id);

  return (
    <ProductProfile
      product={result.data}
      organizationId={activeOrg.id}
      canManage={canManage}
      options={options}
    />
  );
}
