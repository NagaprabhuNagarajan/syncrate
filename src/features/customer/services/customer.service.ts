import type { AppSupabaseClient } from "@/lib/supabase/types";
import { CustomerRepository } from "@/features/customer/repositories/customer.repository";
import { createCustomerSchema } from "@/features/customer/schemas/customer.schemas";
import { objectsToCsv } from "@/utils/csv";
import type {
  Customer,
  CustomerActionResult,
  CustomerError,
  CustomerErrorCode,
  CustomerImportError,
  CustomerImportResult,
  CustomerLedger,
  CustomerListParams,
  CustomerListResult,
  CustomerStats,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "@/features/customer/types/customer.types";

function ok<T>(data: T): CustomerActionResult<T> {
  return { success: true, data };
}

function fail(
  code: CustomerErrorCode,
  message: string
): CustomerActionResult<never> {
  const error: CustomerError = { code, message };
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

export class CustomerService {
  private readonly repo: CustomerRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new CustomerRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listCustomers(
    organizationId: string,
    params?: CustomerListParams
  ): Promise<CustomerListResult> {
    return this.repo.list(organizationId, params);
  }

  async getCustomerStats(organizationId: string): Promise<CustomerStats> {
    return this.repo.getStats(organizationId);
  }

  async getCustomer(
    id: string
  ): Promise<CustomerActionResult<Customer>> {
    const customer = await this.repo.findById(id);
    if (!customer) {
      return fail("not_found", "Customer not found");
    }
    return ok(customer);
  }

  async getCustomerLedger(customer: Customer): Promise<CustomerLedger> {
    const entries = await this.repo.findLedgerEntries(customer.id);
    const last = entries[entries.length - 1];
    const outstanding = last
      ? last.runningBalance
      : customer.openingBalance;
    return {
      openingBalance: customer.openingBalance,
      entries,
      outstanding,
    };
  }

  // ── Create ─────────────────────────────────────────────────

  async createCustomer(
    input: CreateCustomerInput,
    organizationId: string,
    userId: string
  ): Promise<CustomerActionResult<Customer>> {
    const code = await this.resolveCode(organizationId, input.code);

    const existingCode = await this.repo.findByCode(organizationId, code);
    if (existingCode) {
      return fail(
        "duplicate_code",
        `A customer with code "${code}" already exists`
      );
    }

    const gst = nz(input.gstNumber)?.toUpperCase() ?? null;
    if (gst) {
      const existingGst = await this.repo.findByGst(organizationId, gst);
      if (existingGst) {
        return fail(
          "duplicate_gst",
          "A customer with this GST number already exists"
        );
      }
    }

    const customer = await this.repo.create({
      organization_id: organizationId,
      code,
      name: input.name.trim(),
      company: nz(input.company),
      gst_number: gst,
      pan_number: nz(input.panNumber)?.toUpperCase() ?? null,
      mobile: nz(input.mobile),
      email: nz(input.email)?.toLowerCase() ?? null,
      website: nz(input.website),
      billing_address_line1: nz(input.billingAddressLine1),
      billing_address_line2: nz(input.billingAddressLine2),
      billing_city: nz(input.billingCity),
      billing_state: nz(input.billingState),
      billing_pincode: nz(input.billingPincode),
      billing_country: input.billingCountry?.toUpperCase() || "IN",
      shipping_address_line1: nz(input.shippingAddressLine1),
      shipping_address_line2: nz(input.shippingAddressLine2),
      shipping_city: nz(input.shippingCity),
      shipping_state: nz(input.shippingState),
      shipping_pincode: nz(input.shippingPincode),
      shipping_country: nz(input.shippingCountry)?.toUpperCase() ?? null,
      credit_limit: input.creditLimit ?? 0,
      payment_terms_days: input.paymentTermsDays ?? 0,
      preferred_payment_method: nz(input.preferredPaymentMethod),
      opening_balance: input.openingBalance ?? 0,
      tags: input.tags ? [...input.tags] : [],
      notes: nz(input.notes),
      created_by: userId,
    });

    if (!customer) {
      return fail("unknown", "Failed to create customer. Please try again.");
    }

    return ok(customer);
  }

  // ── Update ─────────────────────────────────────────────────

  async updateCustomer(
    customerId: string,
    input: UpdateCustomerInput,
    organizationId: string,
    userId: string
  ): Promise<CustomerActionResult<Customer>> {
    if (input.code !== undefined && input.code.trim() !== "") {
      const code = input.code.toUpperCase().trim();
      const existing = await this.repo.findByCode(organizationId, code);
      if (existing && existing.id !== customerId) {
        return fail(
          "duplicate_code",
          `A customer with code "${code}" already exists`
        );
      }
    }

    const gst = input.gstNumber ? nz(input.gstNumber)?.toUpperCase() : undefined;
    if (gst) {
      const existing = await this.repo.findByGst(organizationId, gst);
      if (existing && existing.id !== customerId) {
        return fail(
          "duplicate_gst",
          "A customer with this GST number already exists"
        );
      }
    }

    const patch = buildUpdatePatch(input);

    // Keep the soft-delete flag consistent with an explicit status change:
    // archiving stamps deleted_at, and moving to any other status restores
    // the record (editing is how an archived customer is brought back).
    if (input.status !== undefined) {
      if (input.status === "archived") {
        patch.deleted_at = new Date().toISOString();
        patch.deleted_by = userId;
      } else {
        patch.deleted_at = null;
        patch.deleted_by = null;
      }
    }

    const customer = await this.repo.update(customerId, patch, userId);

    if (!customer) {
      return fail("not_found", "Customer not found or update failed");
    }

    return ok(customer);
  }

  // ── Archive (soft delete) ──────────────────────────────────

  async archiveCustomer(
    customerId: string,
    userId: string
  ): Promise<CustomerActionResult<void>> {
    const existing = await this.repo.findById(customerId);
    if (!existing) {
      return fail("not_found", "Customer not found");
    }

    const archived = await this.repo.softDelete(customerId, userId);
    if (!archived) {
      return fail("unknown", "Failed to archive customer. Please try again.");
    }
    return ok(undefined);
  }

  async restoreCustomer(
    customerId: string,
    userId: string
  ): Promise<CustomerActionResult<void>> {
    const existing = await this.repo.findById(customerId);
    if (!existing) {
      return fail("not_found", "Customer not found");
    }

    const restored = await this.repo.restore(customerId, userId);
    if (!restored) {
      return fail("unknown", "Failed to restore customer. Please try again.");
    }
    return ok(undefined);
  }

  // ── CSV export ─────────────────────────────────────────────

  /** Serializes every non-deleted customer for the org into CSV text. */
  async exportCustomersCsv(organizationId: string): Promise<string> {
    const customers = await this.repo.findAllForExport(organizationId);
    return objectsToCsv(CSV_COLUMNS, customers.map(toCsvRecord));
  }

  // ── CSV import ─────────────────────────────────────────────

  /**
   * Bulk-creates customers from parsed CSV rows. Validation and per-row
   * failures (duplicate code/GST, invalid data) are collected; the batch
   * always runs to completion. Row numbers are 1-based with the header as
   * row 1, so the first data row is row 2.
   */
  async importCustomers(
    rows: Array<Record<string, string>>,
    organizationId: string,
    userId: string
  ): Promise<CustomerImportResult> {
    let created = 0;
    let skipped = 0;
    const errors: CustomerImportError[] = [];

    for (let i = 0; i < rows.length; i += 1) {
      const rowNumber = i + 2;
      const parsed = createCustomerSchema.safeParse(mapCsvRowToInput(rows[i]));

      if (!parsed.success) {
        skipped += 1;
        errors.push({
          row: rowNumber,
          message: parsed.error.errors[0]?.message ?? "Invalid row",
        });
        continue;
      }

      const result = await this.createCustomer(
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

  /** Resolves a customer code: uses the provided one, or auto-generates the next. */
  private async resolveCode(
    organizationId: string,
    provided?: string
  ): Promise<string> {
    const trimmed = provided?.trim();
    if (trimmed) {
      return trimmed.toUpperCase();
    }
    const { total } = await this.repo.list(organizationId, { pageSize: 1 });
    return `CUST-${String(total + 1).padStart(5, "0")}`;
  }
}

// ─────────────────────────────────────────────────────────────
// Patch builder — only includes provided fields, mapped to snake_case
// ─────────────────────────────────────────────────────────────

function buildUpdatePatch(
  input: UpdateCustomerInput
): Record<string, unknown> {
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
  setText("company", input.company);
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
  setText("billing_address_line1", input.billingAddressLine1);
  setText("billing_address_line2", input.billingAddressLine2);
  setText("billing_city", input.billingCity);
  setText("billing_state", input.billingState);
  setText("billing_pincode", input.billingPincode);
  if (input.billingCountry !== undefined) {
    patch.billing_country = input.billingCountry.toUpperCase();
  }
  setText("shipping_address_line1", input.shippingAddressLine1);
  setText("shipping_address_line2", input.shippingAddressLine2);
  setText("shipping_city", input.shippingCity);
  setText("shipping_state", input.shippingState);
  setText("shipping_pincode", input.shippingPincode);
  if (input.shippingCountry !== undefined) {
    patch.shipping_country = nz(input.shippingCountry)?.toUpperCase() ?? null;
  }
  if (input.creditLimit !== undefined) {
    patch.credit_limit = input.creditLimit;
  }
  if (input.paymentTermsDays !== undefined) {
    patch.payment_terms_days = input.paymentTermsDays;
  }
  setText("preferred_payment_method", input.preferredPaymentMethod);
  if (input.openingBalance !== undefined) {
    patch.opening_balance = input.openingBalance;
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

// ─────────────────────────────────────────────────────────────
// CSV column mapping (stable, shared by export & import)
// ─────────────────────────────────────────────────────────────

const CSV_COLUMNS = [
  "code",
  "name",
  "company",
  "gstNumber",
  "panNumber",
  "mobile",
  "email",
  "website",
  "billingCity",
  "billingState",
  "billingPincode",
  "creditLimit",
  "paymentTermsDays",
  "openingBalance",
  "status",
  "tags",
  "notes",
] as const;

type CsvColumn = (typeof CSV_COLUMNS)[number];
type CsvRecord = Record<CsvColumn, string>;

/** Maps a domain Customer to a flat CSV record. Tags are joined by ";". */
function toCsvRecord(customer: Customer): CsvRecord {
  return {
    code: customer.code,
    name: customer.name,
    company: customer.company ?? "",
    gstNumber: customer.gstNumber ?? "",
    panNumber: customer.panNumber ?? "",
    mobile: customer.mobile ?? "",
    email: customer.email ?? "",
    website: customer.website ?? "",
    billingCity: customer.billingCity ?? "",
    billingState: customer.billingState ?? "",
    billingPincode: customer.billingPincode ?? "",
    creditLimit: String(customer.creditLimit),
    paymentTermsDays: String(customer.paymentTermsDays),
    openingBalance: String(customer.openingBalance),
    status: customer.status,
    tags: customer.tags.join(";"),
    notes: customer.notes ?? "",
  };
}

/** Maps a raw CSV row into a CreateCustomerInput-shaped object for validation. */
function mapCsvRowToInput(row: Record<string, string>): Record<string, unknown> {
  const get = (key: string): string | undefined => {
    const value = row[key];
    if (value === undefined) {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  };

  const rawTags = row.tags;
  const tags = rawTags
    ? rawTags
        .split(";")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    : undefined;

  return {
    code: get("code"),
    name: get("name"),
    company: get("company"),
    gstNumber: get("gstNumber"),
    panNumber: get("panNumber"),
    mobile: get("mobile"),
    email: get("email"),
    website: get("website"),
    billingCity: get("billingCity"),
    billingState: get("billingState"),
    billingPincode: get("billingPincode"),
    creditLimit: get("creditLimit"),
    paymentTermsDays: get("paymentTermsDays"),
    openingBalance: get("openingBalance"),
    tags: tags && tags.length > 0 ? tags : undefined,
    notes: get("notes"),
  };
}
