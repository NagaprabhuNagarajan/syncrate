import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { SerialService } from "@/features/serial/services/serial.service";
import { ErrorState } from "@/components/shared/error-state";
import { SerialsView } from "@/features/serial/components/serials-view";
import type {
  ProductOption,
  WarehouseOption,
} from "@/features/serial/components/serial-form";
import type { SerialStatus } from "@/features/serial/types/serial.types";

export const metadata: Metadata = {
  title: "Serial Numbers",
  description: "Track unique, serialized inventory items",
};

const SERIAL_STATUSES: readonly SerialStatus[] = [
  "in_stock",
  "reserved",
  "sold",
  "returned",
  "damaged",
];

function parseStatus(value?: string): SerialStatus | undefined {
  if (value && SERIAL_STATUSES.includes(value as SerialStatus)) {
    return value as SerialStatus;
  }
  return undefined;
}

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function SerialNumbersPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    org?: string;
    search?: string;
    status?: string;
    productId?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login");
  }

  const orgService = new OrganizationService(supabase);
  const organizations = await orgService.listUserOrganizations(data.user.id);

  if (organizations.length === 0) {
    redirect("/create-organization");
  }

  const orgId = params.org ?? organizations[0]?.id;
  const activeOrg =
    organizations.find((o) => o.id === orgId) ?? organizations[0];

  if (!activeOrg) {
    redirect("/create-organization");
  }

  const context = await orgService.getOrganizationContext(
    activeOrg.id,
    data.user.id
  );

  if (!context || !context.permissions.includes("inventory.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to view serial numbers for this organization."
        />
      </div>
    );
  }

  const canManage = context.permissions.includes("inventory.adjust");

  const search = params.search?.trim() || undefined;
  const status = parseStatus(params.status);
  const productId = params.productId?.trim() || undefined;
  const page = parsePage(params.page);

  const [{ data: productRows }, { data: warehouseRows }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, code")
      .eq("organization_id", activeOrg.id)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("warehouses")
      .select("id, name")
      .eq("organization_id", activeOrg.id)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
  ]);

  const products: ProductOption[] = (productRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
  }));
  const warehouses: WarehouseOption[] = (warehouseRows ?? []).map((w) => ({
    id: w.id,
    name: w.name,
  }));

  const serialService = new SerialService(supabase);
  const result = await serialService.listSerials(activeOrg.id, {
    search,
    status,
    productId,
    page,
  });

  return (
    <SerialsView
      organizationId={activeOrg.id}
      result={result}
      products={products}
      warehouses={warehouses}
      filters={{ search, status, productId }}
      canManage={canManage}
    />
  );
}
