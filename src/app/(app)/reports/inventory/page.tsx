import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { OrganizationService } from '@/features/organization/services/organization.service';
import { getInventoryReport } from '@/features/reports/services/inventory-report.service';
import { InventoryReportView } from '@/features/reports/components/inventory-report-view';

export const metadata: Metadata = {
  title: 'Inventory Report',
  description: 'Current stock levels and low stock alerts',
};

export default async function InventoryReportPage({
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

  const initialData = await getInventoryReport(supabase, activeOrg.id);

  return <InventoryReportView initialData={initialData} orgId={activeOrg.id} />;
}
