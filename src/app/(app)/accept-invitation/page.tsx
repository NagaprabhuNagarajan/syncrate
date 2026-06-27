import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/shared/error-state";
import { AcceptInvitationView } from "@/features/organization/components/accept-invitation-view";

export const metadata: Metadata = {
  title: "Accept Invitation",
  description: "Accept your invitation to join an organization on Syncrate",
};

export default async function AcceptInvitationPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token;

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    const redirectTo = `/accept-invitation${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  if (!token) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Invalid invitation link"
          message="This invitation link is missing its token. Please use the link from your invitation email."
        />
      </div>
    );
  }

  return <AcceptInvitationView token={token} />;
}
