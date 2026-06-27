import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CreateOrganizationForm } from "@/features/organization/components/create-organization-form";

export const metadata: Metadata = {
  title: "Create Organization",
  description: "Set up your business on Syncrate",
};

export default async function CreateOrganizationPage() {
  // Only authenticated users can access this page
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login?redirectTo=/create-organization");
  }

  return <CreateOrganizationForm />;
}
