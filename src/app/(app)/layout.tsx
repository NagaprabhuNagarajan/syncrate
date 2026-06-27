import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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

  return <AppShell userId={data.user.id}>{children}</AppShell>;
}
