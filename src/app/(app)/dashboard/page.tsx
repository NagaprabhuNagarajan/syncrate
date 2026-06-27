import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your Syncrate business overview",
};

export default async function DashboardPage({
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

  return (
    <DashboardView
      organization={activeOrg}
      organizations={organizations}
      userId={data.user.id}
    />
  );
}
