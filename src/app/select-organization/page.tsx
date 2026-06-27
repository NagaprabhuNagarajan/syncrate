import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { SelectOrganizationView } from "@/features/organization/components/select-organization-view";

export const metadata: Metadata = {
  title: "Select Organization | Syncrate",
  description: "Choose the organization you want to work with",
};

export default async function SelectOrganizationPage() {
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

  if (organizations.length === 1 && organizations[0]) {
    redirect(`/dashboard?org=${organizations[0].id}`);
  }

  return (
    <SelectOrganizationView
      organizations={organizations}
      userId={data.user.id}
    />
  );
}
