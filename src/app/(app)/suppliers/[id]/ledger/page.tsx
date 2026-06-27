import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { SupplierService } from "@/features/supplier/services/supplier.service";
import { SupplierLedgerView } from "@/features/supplier/components/supplier-ledger-view";
import { ErrorState } from "@/components/shared/error-state";

interface Props {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { title: "Supplier Ledger" };
  }
  const result = await new SupplierService(supabase).getSupplier(id);
  return {
    title: result.success ? `Ledger — ${result.data.name}` : "Supplier Ledger",
  };
}

export default async function SupplierLedgerPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
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

  const orgId = query.org ?? organizations[0]?.id;
  const activeOrg =
    organizations.find((o) => o.id === orgId) ?? organizations[0];

  if (!activeOrg) {
    redirect("/create-organization");
  }

  const context = await orgService.getOrganizationContext(
    activeOrg.id,
    data.user.id
  );

  if (!context || !context.permissions.includes("supplier.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to view supplier ledgers."
        />
      </div>
    );
  }

  const service = new SupplierService(supabase);
  const result = await service.getSupplier(id);

  if (!result.success || result.data.organizationId !== activeOrg.id) {
    notFound();
  }

  const ledger = await service.getSupplierLedger(result.data);

  return <SupplierLedgerView supplier={result.data} ledger={ledger} />;
}
