import type { AppSupabaseClient } from "@/lib/supabase/types";
import { WarehouseRepository } from "@/features/warehouse/repositories/warehouse.repository";
import type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
  Warehouse,
  WarehouseActionResult,
  WarehouseError,
  WarehouseErrorCode,
  WarehouseListParams,
  WarehouseListResult,
  WarehouseOption,
} from "@/features/warehouse/types/warehouse.types";

function ok<T>(data: T): WarehouseActionResult<T> {
  return { success: true, data };
}

function fail(
  code: WarehouseErrorCode,
  message: string
): WarehouseActionResult<never> {
  const error: WarehouseError = { code, message };
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

export class WarehouseService {
  private readonly repo: WarehouseRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new WarehouseRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listWarehouses(
    organizationId: string,
    params?: WarehouseListParams
  ): Promise<WarehouseListResult> {
    return this.repo.list(organizationId, params);
  }

  async listWarehouseOptions(
    organizationId: string
  ): Promise<WarehouseOption[]> {
    return this.repo.listOptions(organizationId);
  }

  async getWarehouse(id: string): Promise<WarehouseActionResult<Warehouse>> {
    const warehouse = await this.repo.findById(id);
    if (!warehouse) {
      return fail("not_found", "Warehouse not found");
    }
    return ok(warehouse);
  }

  // ── Create ─────────────────────────────────────────────────

  async createWarehouse(
    input: CreateWarehouseInput,
    organizationId: string,
    userId: string
  ): Promise<WarehouseActionResult<Warehouse>> {
    const code = input.code.toUpperCase().trim();

    const existing = await this.repo.findByCode(organizationId, code);
    if (existing) {
      return fail(
        "duplicate_code",
        `A warehouse with code "${code}" already exists`
      );
    }

    const warehouse = await this.repo.create({
      organization_id: organizationId,
      branch_id: nz(input.branchId),
      code,
      name: input.name.trim(),
      address_line1: nz(input.addressLine1),
      city: nz(input.city),
      state: nz(input.state),
      pincode: nz(input.pincode),
      capacity: input.capacity ?? null,
      is_default: input.isDefault ?? false,
      created_by: userId,
    });

    if (!warehouse) {
      return fail("unknown", "Failed to create warehouse. Please try again.");
    }

    return ok(warehouse);
  }

  // ── Update ─────────────────────────────────────────────────

  async updateWarehouse(
    warehouseId: string,
    input: UpdateWarehouseInput,
    organizationId: string,
    userId: string
  ): Promise<WarehouseActionResult<Warehouse>> {
    if (input.code !== undefined && input.code.trim() !== "") {
      const code = input.code.toUpperCase().trim();
      const existing = await this.repo.findByCode(organizationId, code);
      if (existing && existing.id !== warehouseId) {
        return fail(
          "duplicate_code",
          `A warehouse with code "${code}" already exists`
        );
      }
    }

    const warehouse = await this.repo.update(
      warehouseId,
      buildUpdatePatch(input),
      userId
    );

    if (!warehouse) {
      return fail("not_found", "Warehouse not found or update failed");
    }

    return ok(warehouse);
  }

  // ── Archive (soft delete) ──────────────────────────────────

  async archiveWarehouse(
    warehouseId: string,
    userId: string
  ): Promise<WarehouseActionResult<void>> {
    const existing = await this.repo.findById(warehouseId);
    if (!existing) {
      return fail("not_found", "Warehouse not found");
    }

    const archived = await this.repo.softDelete(warehouseId, userId);
    if (!archived) {
      return fail("unknown", "Failed to archive warehouse. Please try again.");
    }
    return ok(undefined);
  }
}

// ─────────────────────────────────────────────────────────────
// Patch builder — only includes provided fields, mapped to snake_case
// ─────────────────────────────────────────────────────────────

function buildUpdatePatch(
  input: UpdateWarehouseInput
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
  setText("branch_id", input.branchId);
  setText("address_line1", input.addressLine1);
  setText("city", input.city);
  setText("state", input.state);
  setText("pincode", input.pincode);
  if (input.capacity !== undefined) {
    patch.capacity = input.capacity;
  }
  if (input.isDefault !== undefined) {
    patch.is_default = input.isDefault;
  }
  if (input.status !== undefined) {
    patch.status = input.status;
  }
  return patch;
}
