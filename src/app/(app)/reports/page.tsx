import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { OrganizationService } from '@/features/organization/services/organization.service';
import { getSalesReport } from '@/features/reports/services/sales-report.service';
import { getPurchaseReport } from '@/features/reports/services/purchase-report.service';
import { getGstReport } from '@/features/reports/services/gst-report.service';
import { getOutstandingReport } from '@/features/reports/services/outstanding-report.service';
import { getInventoryReport } from '@/features/reports/services/inventory-report.service';
import {
  ReportsHub,
  type ReportsHubStats,
  type ReportStat,
} from '@/features/reports/components/reports-hub';
import { formatCurrency } from '@/utils/format';

export const metadata: Metadata = {
  title: 'Reports',
  description: 'Business reports and analytics',
};

function getCurrentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split('T')[0];
  return { from, to };
}

/** Pulls the fulfilled value from an allSettled result, or null on failure. */
function settled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

export default async function ReportsPage({
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
  const activeOrg =
    organizations.find((o) => o.id === orgId) ?? organizations[0];

  if (!activeOrg) {
    redirect('/create-organization');
  }

  const range = getCurrentMonthRange();

  // One slow/failed report must not take the whole hub down.
  const [salesR, purchasesR, gstR, outstandingR, inventoryR] =
    await Promise.allSettled([
      getSalesReport(supabase, activeOrg.id, range),
      getPurchaseReport(supabase, activeOrg.id, range),
      getGstReport(supabase, activeOrg.id, range),
      getOutstandingReport(supabase, activeOrg.id),
      getInventoryReport(supabase, activeOrg.id),
    ]);

  const sales = settled(salesR);
  const purchases = settled(purchasesR);
  const gst = settled(gstR);
  const outstanding = settled(outstandingR);
  const inventory = settled(inventoryR);

  const salesStat: ReportStat | null = sales
    ? {
        primary: formatCurrency(sales.totals.totalAmount),
        secondary: `${sales.summary.reduce(
          (n, r) => n + r.invoiceCount,
          0
        )} invoices · this month`,
      }
    : null;

  const purchaseStat: ReportStat | null = purchases
    ? {
        primary: formatCurrency(purchases.totals.totalAmount),
        secondary: `${purchases.summary.reduce(
          (n, r) => n + r.invoiceCount,
          0
        )} bills · this month`,
      }
    : null;

  const gstStat: ReportStat | null = gst
    ? {
        primary: formatCurrency(gst.totals.totalTax),
        secondary: 'Total tax · this month',
      }
    : null;

  const outstandingStat: ReportStat | null = outstanding
    ? {
        primary: formatCurrency(outstanding.totalReceivable),
        secondary: `Receivable · ${formatCurrency(
          outstanding.totalPayable
        )} payable`,
      }
    : null;

  const stockAlerts = inventory
    ? inventory.totals.lowStock + inventory.totals.outOfStock
    : 0;
  const inventoryStat: ReportStat | null = inventory
    ? {
        primary: `${inventory.totals.totalProducts}`,
        secondary: `SKUs · ${inventory.totals.lowStock} low · ${inventory.totals.outOfStock} out of stock`,
        alert: stockAlerts > 0,
      }
    : null;

  const stats: ReportsHubStats = {
    sales: salesStat,
    purchases: purchaseStat,
    inventory: inventoryStat,
    gst: gstStat,
    outstanding: outstandingStat,
  };

  return <ReportsHub stats={stats} />;
}
