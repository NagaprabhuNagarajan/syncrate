import type { AppSupabaseClient } from "@/lib/supabase/types";
import { UnitRepository } from "@/features/unit/repositories/unit.repository";
import type {
  Unit,
  UnitActionResult,
  UnitError,
  UnitErrorCode,
  UnitListParams,
  UnitListResult,
  CreateUnitInput,
  UpdateUnitInput,
} from "@/features/unit/types/unit.types";

function ok<T>(data: T): UnitActionResult<T> {
  return { success: true, data };
}

function fail(code: UnitErrorCode, message: string): UnitActionResult<never> {
  const error: UnitError = { code, message };
  return { success: false, error };
}

export class UnitService {
  private readonly repo: UnitRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new UnitRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listUnits(
    organizationId: string,
    params?: UnitListParams
  ): Promise<UnitListResult> {
    return this.repo.list(organizationId, params);
  }

  async getUnit(id: string): Promise<UnitActionResult<Unit>> {
    const unit = await this.repo.findById(id);
    if (!unit) {
      return fail("not_found", "Unit not found");
    }
    return ok(unit);
  }

  // ── Create ─────────────────────────────────────────────────

  async createUnit(
    input: CreateUnitInput,
    organizationId: string,
    userId: string
  ): Promise<UnitActionResult<Unit>> {
    const name = input.name.trim();

    const existing = await this.repo.findByName(organizationId, name);
    if (existing) {
      return fail("duplicate_name", `A unit named "${name}" already exists`);
    }

    const unit = await this.repo.create({
      organization_id: organizationId,
      name,
      symbol: input.symbol.trim(),
      status: input.status ?? "active",
      created_by: userId,
    });

    if (!unit) {
      return fail("unknown", "Failed to create unit. Please try again.");
    }

    return ok(unit);
  }

  // ── Update ─────────────────────────────────────────────────

  async updateUnit(
    unitId: string,
    input: UpdateUnitInput,
    organizationId: string,
    userId: string
  ): Promise<UnitActionResult<Unit>> {
    if (input.name !== undefined && input.name.trim() !== "") {
      const name = input.name.trim();
      const existing = await this.repo.findByName(organizationId, name);
      if (existing && existing.id !== unitId) {
        return fail("duplicate_name", `A unit named "${name}" already exists`);
      }
    }

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) {
      patch.name = input.name.trim();
    }
    if (input.symbol !== undefined) {
      patch.symbol = input.symbol.trim();
    }
    if (input.status !== undefined) {
      patch.status = input.status;
    }

    const unit = await this.repo.update(unitId, patch, userId);

    if (!unit) {
      return fail("not_found", "Unit not found or update failed");
    }

    return ok(unit);
  }

  // ── Archive (soft delete) ──────────────────────────────────

  async archiveUnit(
    unitId: string,
    userId: string
  ): Promise<UnitActionResult<void>> {
    const existing = await this.repo.findById(unitId);
    if (!existing) {
      return fail("not_found", "Unit not found");
    }

    const archived = await this.repo.softDelete(unitId, userId);
    if (!archived) {
      return fail("unknown", "Failed to archive unit. Please try again.");
    }
    return ok(undefined);
  }
}
