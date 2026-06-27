import type { AppSupabaseClient } from "@/lib/supabase/types";
import { SupplierRepository } from "@/features/supplier/repositories/supplier.repository";
import { createSupplierSchema } from "@/features/supplier/schemas/supplier.schemas";
import { objectsToCsv } from "@/utils/csv";
import type {
  Supplier,
  SupplierActionResult,
  SupplierError,
  SupplierErrorCode,
  SupplierLedger,
  SupplierListParams,
  SupplierListResult,
  CreateSupplierInput,
  SupplierImportResult,
  UpdateSupplierInput,
} from "@/features/supplier/types/supplier.types";

/** Ordered columns for the supplier CSV export/import contract. */
const EXPORT_COLUMNS = [
  "code",
  "name",
  "contactPerson",
  "gstNumber",
  "panNumber",
  "mobile",
  "email",
  "website",
  "city",
  "state",
  "pincode",
  "bankName",
  "bankAccountNumber",
  "bankIfsc",
  "upiId",
  "paymentTermsDays",
  "openingBalance",
  "rating",
  "status",
  "tags",
  "notes",
] as const;

type ExportColumn = (typeof EXPORT_COLUMNS)[number];

type ExportRow = Record<ExportColumn, string | number>;

function ok<T>(data: T): SupplierActionResult<T> {
  return { success: true, data };
}

function fail(
  code: SupplierErrorCode,
  message: string
): SupplierActionResult<never> {
  const error: SupplierError = { code, message };
  return { success: false, error };
}

/** Normalizes an optional string: trims and converts "" → null. */
function nz(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export class SupplierService {
  private readonly repo: SupplierRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new SupplierRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listSuppliers(
    organizationId: string,
    params?: SupplierListParams
  ): Promise<SupplierListResult> {
    return this.repo.list(organizationId, params);
  }

  async getSupplier(id: string): Promise<SupplierActionResult<Supplier>> {
    const supplier = await this.repo.findById(id);
    if (!supplier) {
      return fail("not_found", "Supplier not found");
    }
    return ok(supplier);
  }

  async getSupplierLedger(supplier: Supplier): Promise<SupplierLedger> {
    const entries = await this.repo.findLedgerEntries(supplier.id);
    const last = entries[entries.length - 1];
    const outstanding = last ? last.runningBalance : supplier.openingBalance;
    return {
      openingBalance: supplier.openingBalance,
      entries,
      outstanding,
    };
  }

  // ── Create ─────────────────────────────────────────────────

  async createSupplier(
    input: CreateSupplierInput,
    organizationId: string,
    userId: string
  ): Promise<SupplierActionResult<Supplier>> {
    const code = await this.resolveCode(organizationId, input.code);

    const existingCode = await this.repo.findByCode(organizationId, code);
    if (existingCode) {
      return fail(
        "duplicate_code",
        `A supplier with code "${code}" already exists`
      );
    }

    const gst = nz(input.gstNumber)?.toUpperCase() ?? null;
    if (gst) {
      const existingGst = await this.repo.findByGst(organizationId, gst);
      if (existingGst) {
        return fail(
          "duplicate_gst",
          "A supplier with this GST number already exists"
        );
      }
    }

    const supplier = await this.repo.create({
      organization_id: organizationId,
      code,
      name: input.name.trim(),
      contact_person: nz(input.contactPerson),
      gst_number: gst,
      pan_number: nz(input.panNumber)?.toUpperCase() ?? null,
      mobile: nz(input.mobile),
      email: nz(input.email)?.toLowerCase() ?? null,
      website: nz(input.website),
      address_line1: nz(input.addressLine1),
      address_line2: nz(input.addressLine2),
      city: nz(input.city),
      state: nz(input.state),
      pincode: nz(input.pincode),
      country: input.country?.toUpperCase() || "IN",
      bank_account_name: nz(input.bankAccountName),
      bank_account_number: nz(input.bankAccountNumber),
      bank_ifsc: nz(input.bankIfsc)?.toUpperCase() ?? null,
      bank_name: nz(input.bankName),
      upi_id: nz(input.upiId),
      payment_terms_days: input.paymentTermsDays ?? 0,
      opening_balance: input.openingBalance ?? 0,
      rating: input.rating ?? null,
      tags: input.tags ? [...input.tags] : [],
      notes: nz(input.notes),
      created_by: userId,
    });

    if (!supplier) {
      return fail("unknown", "Failed to create supplier. Please try again.");
    }

    return ok(supplier);
  }

  // ── Update ─────────────────────────────────────────────────

  async updateSupplier(
    supplierId: string,
    input: UpdateSupplierInput,
    organizationId: string,
    userId: string
  ): Promise<SupplierActionResult<Supplier>> {
    if (input.code !== undefined && input.code.trim() !== "") {
      const code = input.code.toUpperCase().trim();
      const existing = await this.repo.findByCode(organizationId, code);
      if (existing && existing.id !== supplierId) {
        return fail(
          "duplicate_code",
          `A supplier with code "${code}" already exists`
        );
      }
    }

    const gst = input.gstNumber ? nz(input.gstNumber)?.toUpperCase() : undefined;
    if (gst) {
      const existing = await this.repo.findByGst(organizationId, gst);
      if (existing && existing.id !== supplierId) {
        return fail(
          "duplicate_gst",
          "A supplier with this GST number already exists"
        );
      }
    }

    const supplier = await this.repo.update(
      supplierId,
      buildUpdatePatch(input),
      userId
    );

    if (!supplier) {
      return fail("not_found", "Supplier not found or update failed");
    }

    return ok(supplier);
  }

  // ── Archive (soft delete) ──────────────────────────────────

  async archiveSupplier(
    supplierId: string,
    userId: string
  ): Promise<SupplierActionResult<void>> {
    const existing = await this.repo.findById(supplierId);
    if (!existing) {
      return fail("not_found", "Supplier not found");
    }

    const archived = await this.repo.softDelete(supplierId, userId);
    if (!archived) {
      return fail("unknown", "Failed to archive supplier. Please try again.");
    }
    return ok(undefined);
  }

  // ── Export ─────────────────────────────────────────────────

  /** Serializes every non-deleted supplier in the org to CSV text. */
  async exportSuppliersCsv(organizationId: string): Promise<string> {
    const suppliers = await this.repo.findAllForExport(organizationId);
    const rows: ExportRow[] = suppliers.map((s) => ({
      code: s.code,
      name: s.name,
      contactPerson: s.contactPerson ?? "",
      gstNumber: s.gstNumber ?? "",
      panNumber: s.panNumber ?? "",
      mobile: s.mobile ?? "",
      email: s.email ?? "",
      website: s.website ?? "",
      city: s.city ?? "",
      state: s.state ?? "",
      pincode: s.pincode ?? "",
      bankName: s.bankName ?? "",
      bankAccountNumber: s.bankAccountNumber ?? "",
      bankIfsc: s.bankIfsc ?? "",
      upiId: s.upiId ?? "",
      paymentTermsDays: s.paymentTermsDays,
      openingBalance: s.openingBalance,
      rating: s.rating ?? "",
      status: s.status,
      tags: s.tags.join(";"),
      notes: s.notes ?? "",
    }));
    return objectsToCsv(EXPORT_COLUMNS, rows);
  }

  // ── Import ─────────────────────────────────────────────────

  /**
   * Imports suppliers from parsed CSV rows. Each row is validated and created
   * independently; validation/duplicate failures are collected per row (with
   * 1-based row numbers where the header is row 1) and never abort the batch.
   */
  async importSuppliers(
    rows: ReadonlyArray<Record<string, string>>,
    organizationId: string,
    userId: string
  ): Promise<SupplierImportResult> {
    let created = 0;
    let skipped = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < rows.length; i += 1) {
      const rowNumber = i + 2; // header occupies row 1
      const parsed = createSupplierSchema.safeParse(mapImportRow(rows[i]));

      if (!parsed.success) {
        skipped += 1;
        errors.push({
          row: rowNumber,
          message: parsed.error.errors[0]?.message ?? "Invalid row",
        });
        continue;
      }

      const result = await this.createSupplier(
        parsed.data,
        organizationId,
        userId
      );
      if (result.success) {
        created += 1;
      } else {
        skipped += 1;
        errors.push({ row: rowNumber, message: result.error.message });
      }
    }

    return { created, skipped, errors };
  }

  // ── Helpers ────────────────────────────────────────────────

  /** Resolves a supplier code: uses the provided one, or auto-generates the next. */
  private async resolveCode(
    organizationId: string,
    provided?: string
  ): Promise<string> {
    const trimmed = provided?.trim();
    if (trimmed) {
      return trimmed.toUpperCase();
    }
    const { total } = await this.repo.list(organizationId, { pageSize: 1 });
    return `SUPP-${String(total + 1).padStart(5, "0")}`;
  }
}

// ─────────────────────────────────────────────────────────────
// CSV import row → schema input
// ─────────────────────────────────────────────────────────────

/**
 * Maps a raw CSV record to the create-supplier schema input. Empty cells
 * become `undefined` so optional validators are skipped, and `tags` is split
 * on ";". The `status` column is intentionally ignored (creates are active).
 */
function mapImportRow(row: Record<string, string>): Record<string, unknown> {
  const get = (key: string): string => (row[key] ?? "").trim();
  const opt = (key: string): string | undefined => {
    const value = get(key);
    return value === "" ? undefined : value;
  };
  const tagsRaw = get("tags");
  const tags = tagsRaw
    ? tagsRaw
        .split(";")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    : undefined;

  return {
    code: opt("code"),
    name: get("name"),
    contactPerson: opt("contactPerson"),
    gstNumber: opt("gstNumber"),
    panNumber: opt("panNumber"),
    mobile: opt("mobile"),
    email: opt("email"),
    website: opt("website"),
    city: opt("city"),
    state: opt("state"),
    pincode: opt("pincode"),
    bankName: opt("bankName"),
    bankAccountNumber: opt("bankAccountNumber"),
    bankIfsc: opt("bankIfsc"),
    upiId: opt("upiId"),
    paymentTermsDays: opt("paymentTermsDays"),
    openingBalance: opt("openingBalance"),
    rating: opt("rating"),
    tags,
    notes: opt("notes"),
  };
}

// ─────────────────────────────────────────────────────────────
// Patch builder — only includes provided fields, mapped to snake_case
// ─────────────────────────────────────────────────────────────

function buildUpdatePatch(input: UpdateSupplierInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const setText = (key: string, value: string | undefined) => {
    if (value !== undefined) {
      patch[key] = nz(value);
    }
  };

  if (input.code !== undefined && input.code.trim() !== "") {
    patch.code = input.code.toUpperCase().trim();
  }
  if (input.name !== undefined) {
    patch.name = input.name.trim();
  }
  setText("contact_person", input.contactPerson);
  if (input.gstNumber !== undefined) {
    patch.gst_number = nz(input.gstNumber)?.toUpperCase() ?? null;
  }
  if (input.panNumber !== undefined) {
    patch.pan_number = nz(input.panNumber)?.toUpperCase() ?? null;
  }
  setText("mobile", input.mobile);
  if (input.email !== undefined) {
    patch.email = nz(input.email)?.toLowerCase() ?? null;
  }
  setText("website", input.website);
  setText("address_line1", input.addressLine1);
  setText("address_line2", input.addressLine2);
  setText("city", input.city);
  setText("state", input.state);
  setText("pincode", input.pincode);
  if (input.country !== undefined) {
    patch.country = input.country.toUpperCase();
  }
  setText("bank_account_name", input.bankAccountName);
  setText("bank_account_number", input.bankAccountNumber);
  if (input.bankIfsc !== undefined) {
    patch.bank_ifsc = nz(input.bankIfsc)?.toUpperCase() ?? null;
  }
  setText("bank_name", input.bankName);
  setText("upi_id", input.upiId);
  if (input.paymentTermsDays !== undefined) {
    patch.payment_terms_days = input.paymentTermsDays;
  }
  if (input.openingBalance !== undefined) {
    patch.opening_balance = input.openingBalance;
  }
  if (input.rating !== undefined) {
    patch.rating = input.rating;
  }
  if (input.tags !== undefined) {
    patch.tags = [...input.tags];
  }
  setText("notes", input.notes);
  if (input.status !== undefined) {
    patch.status = input.status;
  }
  return patch;
}
