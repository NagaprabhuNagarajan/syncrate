import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { QuotationService } from "@/features/sales/services/quotation.service";
import { ErrorState } from "@/components/shared/error-state";
import { QuotationForm } from "@/features/sales/components/quotation-form";
import { fetchQuotationFormOptions } from "@/features/sales/server/sales-form-options";

export const metadata: Metadata = {
  title: "Edit quotation",
  description: "Update the draft quotation",
};

interface EditQuotationPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}

export default async function EditQuotationPage({
  params,
  searchParams,
}: EditQuotationPageProps) {
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

  if (!context || !context.permissions.includes("sales.create")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to edit quotations for this organization."
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

  if (result.data.status !== "draft") {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Cannot edit this quotation"
          message="Only draft quotations can be edited. This quotation has already been submitted."
        />
      </div>
    );
  }

  const options = await fetchQuotationFormOptions(supabase, activeOrg.id);

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto w-full max-w-5xl">
        <QuotationForm
          organizationId={activeOrg.id}
          orgState={context.organization.state ?? ""}
          customers={options.customers}
          products={options.products}
          quotation={result.data}
        />
      </div>
    </div>
  );
}
