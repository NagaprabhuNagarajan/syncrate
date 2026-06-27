import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { OrganizationService } from '@/features/organization/services/organization.service';
import { getOutstandingReport } from '@/features/reports/services/outstanding-report.service';
import { OutstandingReportView } from '@/features/reports/components/outstanding-report-view';

export const metadata: Metadata = {
  title: 'Outstanding Report',
  description: 'Customer receivables and supplier payables',
};

export default async function OutstandingReportPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ org?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect('/login');
  }

  const orgService = new OrganizationService(supabase);
  const organizations = await orgService.listUserOrganizations(data.user.id);

  if (organizations.length === 0) {
    redirect('/create-organization');
  }

  const orgId = params.org ?? organizations[0]?.id;
  const activeOrg = organizations.find((o) => o.id === orgId) ?? organizations[0];

  if (!activeOrg) {
    redirect('/create-organization');
  }

  const initialData = await getOutstandingReport(supabase, activeOrg.id);

  return <OutstandingReportView initialData={initialData} orgId={activeOrg.id} />;
}
