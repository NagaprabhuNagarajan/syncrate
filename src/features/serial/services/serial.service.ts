import type { AppSupabaseClient } from "@/lib/supabase/types";
import { SerialRepository } from "@/features/serial/repositories/serial.repository";
import type {
  SerialNumber,
  SerialActionResult,
  SerialError,
  SerialErrorCode,
  SerialListParams,
  SerialListResult,
  CreateSerialInput,
  UpdateSerialInput,
  BulkSerialError,
  BulkSerialResult,
} from "@/features/serial/types/serial.types";

function ok<T>(data: T): SerialActionResult<T> {
  return { success: true, data };
}

function fail(
  code: SerialErrorCode,
  message: string
): SerialActionResult<never> {
  const error: SerialError = { code, message };
  return { success: false, error };
}

/** Normalizes an optional string: trims and converts "" → null. */
function nz(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export class SerialService {
  private readonly repo: SerialRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new SerialRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listSerials(
    organizationId: string,
    params?: SerialListParams
  ): Promise<SerialListResult> {
    return this.repo.list(organizationId, params);
  }

  async getSerial(id: string): Promise<SerialActionResult<SerialNumber>> {
    const serial = await this.repo.findById(id);
    if (!serial) {
      return fail("not_found", "Serial number not found");
    }
    return ok(serial);
  }

  // ── Create (single) ────────────────────────────────────────

  async createSerial(
    input: CreateSerialInput,
    organizationId: string,
    userId: string
  ): Promise<SerialActionResult<SerialNumber>> {
    const serialNumber = input.serialNumber.trim();

    const existing = await this.repo.findBySerial(organizationId, serialNumber);
    if (existing) {
      return fail(
        "duplicate_serial",
        `Serial number "${serialNumber}" already exists`
      );
    }

    const created = await this.repo.create({
      organization_id: organizationId,
      product_id: input.productId,
      branch_id: nz(input.branchId),
      batch_id: nz(input.batchId),
      serial_number: serialNumber,
      status: "in_stock",
      notes: nz(input.notes),
      created_by: userId,
    });

    if (!created) {
      return fail("unknown", "Failed to register serial. Please try again.");
    }

    return ok(created);
  }

  // ── Bulk create ────────────────────────────────────────────

  /**
   * Registers many serials for a single product. Duplicates (existing in the
   * DB or repeated within the batch) and failures are collected; the batch
   * always runs to completion.
   */
  async bulkCreateSerials(
    serials: readonly string[],
    productId: string,
    organizationId: string,
    userId: string,
    options: {
      readonly branchId?: string | null;
      readonly batchId?: string | null;
      readonly notes?: string;
    } = {}
  ): Promise<BulkSerialResult> {
    let created = 0;
    let skipped = 0;
    const errors: BulkSerialError[] = [];
    const seen = new Set<string>();

    for (const raw of serials) {
      const serialNumber = raw.trim();
      if (serialNumber === "") {
        continue;
      }

      if (seen.has(serialNumber)) {
        skipped += 1;
        errors.push({
          serial: serialNumber,
          message: "Duplicate within this batch",
        });
        continue;
      }
      seen.add(serialNumber);

      const result = await this.createSerial(
        {
          productId,
          serialNumber,
          branchId: options.branchId ?? null,
          batchId: options.batchId ?? null,
          notes: options.notes,
        },
        organizationId,
        userId
      );

      if (result.success) {
        created += 1;
      } else {
        skipped += 1;
        errors.push({ serial: serialNumber, message: result.error.message });
      }
    }

    return { created, skipped, errors };
  }

  // ── Update ─────────────────────────────────────────────────

  async updateSerial(
    serialId: string,
    input: UpdateSerialInput,
    organizationId: string,
    userId: string
  ): Promise<SerialActionResult<SerialNumber>> {
    if (input.serialNumber !== undefined && input.serialNumber.trim() !== "") {
      const serialNumber = input.serialNumber.trim();
      const existing = await this.repo.findBySerial(
        organizationId,
        serialNumber
      );
      if (existing && existing.id !== serialId) {
        return fail(
          "duplicate_serial",
          `Serial number "${serialNumber}" already exists`
        );
      }
    }

    const updated = await this.repo.update(
      serialId,
      buildUpdatePatch(input),
      userId
    );

    if (!updated) {
      return fail("not_found", "Serial number not found or update failed");
    }

    return ok(updated);
  }

  // ── Archive (soft delete) ──────────────────────────────────

  async archiveSerial(
    serialId: string,
    userId: string
  ): Promise<SerialActionResult<void>> {
    const existing = await this.repo.findById(serialId);
    if (!existing) {
      return fail("not_found", "Serial number not found");
    }

    const archived = await this.repo.softDelete(serialId, userId);
    if (!archived) {
      return fail("unknown", "Failed to archive serial. Please try again.");
    }
    return ok(undefined);
  }
}

// ─────────────────────────────────────────────────────────────
// Patch builder — only includes provided fields, mapped to snake_case
// ─────────────────────────────────────────────────────────────

function buildUpdatePatch(
  input: UpdateSerialInput
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (input.serialNumber !== undefined && input.serialNumber.trim() !== "") {
    patch.serial_number = input.serialNumber.trim();
  }
  if (input.branchId !== undefined) {
    patch.branch_id = nz(input.branchId);
  }
  if (input.batchId !== undefined) {
    patch.batch_id = nz(input.batchId);
  }
  if (input.status !== undefined) {
    patch.status = input.status;
  }
  if (input.notes !== undefined) {
    patch.notes = nz(input.notes);
  }
  return patch;
}
