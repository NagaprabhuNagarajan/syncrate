import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AppShell } from "@/components/shared/app-shell";

export const metadata: Metadata = {
  title: {
    template: "%s | Syncrate",
    default: "Syncrate",
  },
};

/**
 * App layout — authenticated shell with sidebar navigation.
 * Protects all (app) routes.
 */
export default async function AppLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login");
  }

  // Resolve the signed-in user's role for the sidebar badge. The layout has no
  // ?org= param, so this reflects their primary organization.
  const orgService = new OrganizationService(supabase);
  const organizations = await orgService.listUserOrganizations(data.user.id);
  const primaryOrg = organizations[0];
  const userRole = primaryOrg
    ? await orgService.getUserRoleName(primaryOrg.id, data.user.id)
    : null;

  return (
    <AppShell
      userId={data.user.id}
      userEmail={data.user.email ?? null}
      userRole={userRole}
    >
      {children}
    </AppShell>
  );
}
