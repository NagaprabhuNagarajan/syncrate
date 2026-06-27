import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { ProductService } from "@/features/product/services/product.service";
import { ErrorState } from "@/components/shared/error-state";
import { ProductForm } from "@/features/product/components/product-form";
import { fetchProductOptions } from "@/features/product/server/product-options";

export const metadata: Metadata = {
  title: "Edit product",
  description: "Update product details",
};

interface EditProductPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}

export default async function EditProductPage({
  params,
  searchParams,
}: EditProductPageProps) {
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

  if (!context || !context.permissions.includes("product.update")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to edit products for this organization."
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

  const options = await fetchProductOptions(supabase, activeOrg.id);

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto w-full max-w-3xl">
        <ProductForm
          organizationId={activeOrg.id}
          product={result.data}
          categories={options.categories}
          brands={options.brands}
          units={options.units}
          suppliers={options.suppliers}
        />
      </div>
    </div>
  );
}
