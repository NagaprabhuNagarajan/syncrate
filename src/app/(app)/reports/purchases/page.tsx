import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { OrganizationService } from '@/features/organization/services/organization.service';
import { getPurchaseReport } from '@/features/reports/services/purchase-report.service';
import { PurchaseReportView } from '@/features/reports/components/purchase-report-view';

export const metadata: Metadata = {
  title: 'Purchase Report',
  description: 'Monthly purchase totals and supplier breakdown',
};

function getCurrentMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  return { from, to };
}

export default async function PurchaseReportPage({
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

  const dateRange = getCurrentMonthRange();
  const initialData = await getPurchaseReport(supabase, activeOrg.id, dateRange);

  return <PurchaseReportView initialData={initialData} orgId={activeOrg.id} />;
}
