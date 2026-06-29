import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { ErrorState } from "@/components/shared/error-state";
import { SmartReportsView } from "@/features/ai/reports/components";

export const metadata: Metadata = {
  title: "Smart Reports",
  description: "AI-generated, explainable reports across your business",
};

export default async function SmartReportsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ org?: string }>;
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

  if (!context || !context.permissions.includes("ai.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to use AI features for this organization."
        />
      </div>
    );
  }

  const canGenerate = context.permissions.includes("ai.generate");

  return (
    <SmartReportsView organizationId={activeOrg.id} canGenerate={canGenerate} />
  );
}
