import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { ErrorState } from "@/components/shared/error-state";
import { CustomerForm } from "@/features/customer/components/customer-form";

export const metadata: Metadata = {
  title: "New customer",
  description: "Add a new customer to your organization",
};

export default async function NewCustomerPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ org?: string }>;
}) {
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

  if (!context || !context.permissions.includes("customer.create")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to create customers for this organization."
        />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto w-full max-w-3xl">
        <CustomerForm organizationId={activeOrg.id} />
      </div>
    </div>
  );
}
