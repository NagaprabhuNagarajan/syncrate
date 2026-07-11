import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { ErrorState } from "@/components/shared/error-state";
import { OrganizationProfileForm } from "@/features/organization/components/organization-profile-form";

export const metadata: Metadata = {
  title: "Organization",
  description: "Manage your organization's profile and registered details",
};

export default async function OrganizationSettingsPage({
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

  const service = new OrganizationService(supabase);
  const organizations = await service.listUserOrganizations(data.user.id);

  if (organizations.length === 0) {
    redirect("/create-organization");
  }

  // Resolve active org from URL param or default to first
  const orgId = params.org ?? organizations[0]?.id;
  const activeOrg =
    organizations.find((o) => o.id === orgId) ?? organizations[0];

  if (!activeOrg) {
    redirect("/create-organization");
  }

  const context = await service.getOrganizationContext(
    activeOrg.id,
    data.user.id
  );

  if (!context || !context.permissions.includes("settings.manage")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to manage this organization's profile."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <OrganizationProfileForm
        organizationId={activeOrg.id}
        organization={context.organization}
      />
    </div>
  );
}
