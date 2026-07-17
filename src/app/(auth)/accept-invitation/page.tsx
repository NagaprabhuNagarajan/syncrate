import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
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
    const redirectTo = `/accept-invitation${
      token ? `?token=${encodeURIComponent(token)}` : ""
    }`;
    redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  // The invitee isn't an org member yet, so RLS would hide the organization
  // from their session. This preview is authorised by the secret token, so read
  // it with the service-role client (bypasses RLS).
  const details = token
    ? await new OrganizationService(
        await createServiceRoleClient()
      ).getInvitationDetails(token)
    : null;

  return (
    <AcceptInvitationView
      token={token ?? null}
      details={details?.success ? details.data : null}
      detailsError={
        !token
          ? "This invitation link is missing its token."
          : details && !details.success
            ? details.error.message
            : null
      }
    />
  );
}
