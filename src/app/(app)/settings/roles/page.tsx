import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { RoleService } from "@/features/rbac/services/role.service";
import { ErrorState } from "@/components/shared/error-state";
import { RolesView } from "@/features/rbac/components/roles-view";

export const metadata: Metadata = {
  title: "Roles & Permissions",
  description: "Manage custom roles and permissions for your organization",
};

export default async function RolesPage({
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

  if (!context || !context.permissions.includes("role.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You don't have permission to manage this organization's roles. Contact an administrator if you believe this is a mistake."
        />
      </div>
    );
  }

  const canManage = context.permissions.includes("role.manage");
  const roleService = new RoleService(supabase);
  const [roles, permissions] = await Promise.all([
    roleService.listRolesWithPermissions(activeOrg.id),
    roleService.listPermissions(),
  ]);

  return (
    <RolesView
      organizationId={activeOrg.id}
      roles={roles}
      permissions={permissions}
      canManage={canManage}
    />
  );
}
