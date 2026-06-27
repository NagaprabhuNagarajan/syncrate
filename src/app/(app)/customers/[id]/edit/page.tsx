import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { CustomerService } from "@/features/customer/services/customer.service";
import { ErrorState } from "@/components/shared/error-state";
import { CustomerForm } from "@/features/customer/components/customer-form";

export const metadata: Metadata = {
  title: "Edit customer",
  description: "Update customer details",
};

interface EditCustomerPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}

export default async function EditCustomerPage({
  params,
  searchParams,
}: EditCustomerPageProps) {
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

  if (!context || !context.permissions.includes("customer.update")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to edit customers for this organization."
        />
      </div>
    );
  }

  const customerService = new CustomerService(supabase);
  const result = await customerService.getCustomer(id);

  if (!result.success || result.data.organizationId !== activeOrg.id) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Customer not found"
          message="This customer does not exist or belongs to another organization."
        />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto w-full max-w-3xl">
        <CustomerForm
          organizationId={activeOrg.id}
          customer={result.data}
        />
      </div>
    </div>
  );
}
