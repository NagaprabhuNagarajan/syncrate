"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Truck,
  Plus,
  Pencil,
  Archive,
  AlertTriangle,
  Search,
  Mail,
  Phone,
  Star,
  Download,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  archiveSupplierAction,
  exportSuppliersAction,
} from "@/features/supplier/actions/supplier.actions";
import type {
  Supplier,
  SupplierStatus,
} from "@/features/supplier/types/supplier.types";
import { cn } from "@/utils/cn";
import { SupplierImportDialog } from "./supplier-import-dialog";

// ─────────────────────────────────────────────────────────────
// Status badge mapping
// ─────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<
  SupplierStatus,
  "success" | "muted" | "secondary"
> = {
  active: "success",
  inactive: "muted",
  archived: "secondary",
};

const STATUS_LABEL: Record<SupplierStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};

const STATUS_FILTERS: { value: SupplierStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

function supplierHref(organizationId: string, path: string): string {
  return `${path}?org=${organizationId}`;
}

// ─────────────────────────────────────────────────────────────
// Supplier card
// ─────────────────────────────────────────────────────────────

interface SupplierCardProps {
  readonly supplier: Supplier;
  readonly index: number;
  readonly organizationId: string;
  readonly onArchive: (supplier: Supplier) => void;
}

function SupplierCard({
  supplier,
  index,
  organizationId,
  onArchive,
}: SupplierCardProps) {
  const location = [supplier.city, supplier.state].filter(Boolean).join(", ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
          <Truck className="h-5 w-5 text-primary-600" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={supplierHref(organizationId, `/suppliers/${supplier.id}`)}
            className="block truncate text-sm font-semibold text-slate-900 hover:text-primary-600 hover:underline"
          >
            {supplier.name}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{supplier.code}</Badge>
            <Badge variant={STATUS_VARIANT[supplier.status]}>
              {STATUS_LABEL[supplier.status]}
            </Badge>
            {supplier.rating !== null && (
              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-600">
                <Star
                  className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                  aria-hidden="true"
                />
                {supplier.rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>

      <dl className="mt-4 space-y-1.5 text-xs text-slate-500">
        {supplier.contactPerson && (
          <div>
            <dt className="inline font-medium text-slate-400">Contact: </dt>
            <dd className="inline">{supplier.contactPerson}</dd>
          </div>
        )}
        {supplier.mobile && (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <dd>{supplier.mobile}</dd>
          </div>
        )}
        {supplier.email && (
          <div className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <dd className="truncate">{supplier.email}</dd>
          </div>
        )}
        {location && (
          <div>
            <dt className="inline font-medium text-slate-400">Location: </dt>
            <dd className="inline">{location}</dd>
          </div>
        )}
      </dl>

      <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4">
        <Button
          asChild
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Edit ${supplier.name}`}
        >
          <Link
            href={supplierHref(
              organizationId,
              `/suppliers/${supplier.id}/edit`
            )}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Edit
          </Link>
        </Button>
        {supplier.status !== "archived" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-error-600 hover:bg-error-50 hover:text-error-700"
            onClick={() => onArchive(supplier)}
            aria-label={`Archive ${supplier.name}`}
          >
            <Archive className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Archive
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Archive confirmation dialog
// ─────────────────────────────────────────────────────────────

interface ArchiveDialogProps {
  readonly supplier: Supplier;
  readonly isPending: boolean;
  readonly error: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function ArchiveDialog({
  supplier,
  isPending,
  error,
  onConfirm,
  onCancel,
}: ArchiveDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-supplier-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start gap-4">
          <div className="bg-error-50 flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <AlertTriangle
              className="text-error-600 h-5 w-5"
              aria-hidden="true"
            />
          </div>
          <div>
            <h2
              id="archive-supplier-title"
              className="text-base font-semibold text-slate-900"
            >
              Archive supplier
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Are you sure you want to archive{" "}
              <span className="font-medium text-slate-700">
                {supplier.name}
              </span>
              ? Archived suppliers remain available for historical reports.
            </p>
          </div>
        </div>

        {error && (
          <div
            className="border-error-200 bg-error-50 text-error-800 mt-4 rounded-lg border px-4 py-3 text-sm"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            loading={isPending}
            disabled={isPending}
          >
            Archive supplier
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Suppliers view
// ─────────────────────────────────────────────────────────────

interface SuppliersViewProps {
  readonly organizationId: string;
  readonly suppliers: Supplier[];
  readonly canManage?: boolean;
}

export function SuppliersView({
  organizationId,
  suppliers,
  canManage = false,
}: SuppliersViewProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SupplierStatus | "all">(
    "all"
  );
  const [archiveTarget, setArchiveTarget] = useState<Supplier | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isArchiving, startArchiveTransition] = useTransition();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, startExportTransition] = useTransition();

  const handleExport = () => {
    setExportError(null);
    startExportTransition(async () => {
      const result = await exportSuppliersAction(organizationId);
      if (!result.success) {
        setExportError(result.error.message);
        return;
      }
      const blob = new Blob([result.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "suppliers.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return suppliers.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) {
        return false;
      }
      if (!term) {
        return true;
      }
      return [s.name, s.code, s.contactPerson, s.mobile, s.email]
        .filter(Boolean)
        .some((field) => field?.toLowerCase().includes(term));
    });
  }, [suppliers, search, statusFilter]);

  const handleArchiveConfirm = () => {
    if (!archiveTarget) {
      return;
    }
    setArchiveError(null);
    startArchiveTransition(async () => {
      const result = await archiveSupplierAction(
        organizationId,
        archiveTarget.id
      );
      if (!result.success) {
        setArchiveError(result.error.message);
        return;
      }
      setArchiveTarget(null);
      router.refresh();
    });
  };

  const closeArchiveDialog = () => {
    setArchiveTarget(null);
    setArchiveError(null);
  };

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Suppliers"
        description="Manage your supplier relationships and procurement contacts"
        icon={Truck}
      >
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleExport}
                loading={isExporting}
                disabled={isExporting}
              >
                <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Export
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsImportOpen(true)}
              >
                <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Import
              </Button>
            </>
          )}
          <Button asChild type="button">
            <Link href={supplierHref(organizationId, "/suppliers/new")}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Add supplier
            </Link>
          </Button>
        </div>
      </PageHeader>

      {exportError && (
        <div
          className="border-error-200 bg-error-50 text-error-800 mt-4 rounded-lg border px-4 py-3 text-sm"
          role="alert"
        >
          {exportError}
        </div>
      )}

      {suppliers.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search suppliers"
              aria-label="Search suppliers"
              className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Filter by status"
          >
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                aria-pressed={statusFilter === f.value}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  statusFilter === f.value
                    ? "border-primary-600 bg-primary-50 text-primary-700"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        {suppliers.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No suppliers yet"
            description="Add your first supplier to start managing procurement and payables."
            action={{
              label: "Add supplier",
              icon: Plus,
              onClick: () =>
                router.push(supplierHref(organizationId, "/suppliers/new")),
            }}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matching suppliers"
            description="Try adjusting your search or status filter."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((supplier, i) => (
              <SupplierCard
                key={supplier.id}
                supplier={supplier}
                index={i}
                organizationId={organizationId}
                onArchive={(s) => {
                  setArchiveError(null);
                  setArchiveTarget(s);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {archiveTarget && (
          <ArchiveDialog
            supplier={archiveTarget}
            isPending={isArchiving}
            error={archiveError}
            onConfirm={handleArchiveConfirm}
            onCancel={closeArchiveDialog}
          />
        )}
      </AnimatePresence>

      {isImportOpen && (
        <SupplierImportDialog
          organizationId={organizationId}
          onClose={() => setIsImportOpen(false)}
          onImported={() => router.refresh()}
        />
      )}
    </div>
  );
}
