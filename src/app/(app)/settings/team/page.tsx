import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { ErrorState } from "@/components/shared/error-state";
import { TeamManagementView } from "@/features/organization/components/team-management-view";

export const metadata: Metadata = {
  title: "Team",
  description: "Manage members and invitations for your organization",
};

export default async function TeamPage({
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

  if (!context || !context.permissions.includes("settings.users")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You don't have permission to manage this organization's team. Contact an administrator if you believe this is a mistake."
        />
      </div>
    );
  }

  const [members, roles, branches, pendingInvitations, declinedInvitations] =
    await Promise.all([
      service.listMembersWithUser(activeOrg.id),
      service.listRoles(activeOrg.id),
      service.listBranches(activeOrg.id),
      service.listPendingInvitations(activeOrg.id),
      service.listDeclinedInvitations(activeOrg.id),
    ]);

  return (
    <TeamManagementView
      organizationId={activeOrg.id}
      members={members}
      roles={roles}
      branches={branches}
      pendingInvitations={pendingInvitations}
      declinedInvitations={declinedInvitations}
    />
  );
}
