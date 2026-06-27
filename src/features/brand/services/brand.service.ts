import type { AppSupabaseClient } from "@/lib/supabase/types";
import { BrandRepository } from "@/features/brand/repositories/brand.repository";
import type {
  Brand,
  BrandActionResult,
  BrandError,
  BrandErrorCode,
  BrandListParams,
  BrandListResult,
  CreateBrandInput,
  UpdateBrandInput,
} from "@/features/brand/types/brand.types";

function ok<T>(data: T): BrandActionResult<T> {
  return { success: true, data };
}

function fail(
  code: BrandErrorCode,
  message: string
): BrandActionResult<never> {
  const error: BrandError = { code, message };
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

export class BrandService {
  private readonly repo: BrandRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new BrandRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listBrands(
    organizationId: string,
    params?: BrandListParams
  ): Promise<BrandListResult> {
    return this.repo.list(organizationId, params);
  }

  async getBrand(id: string): Promise<BrandActionResult<Brand>> {
    const brand = await this.repo.findById(id);
    if (!brand) {
      return fail("not_found", "Brand not found");
    }
    return ok(brand);
  }

  // ── Create ─────────────────────────────────────────────────

  async createBrand(
    input: CreateBrandInput,
    organizationId: string,
    userId: string
  ): Promise<BrandActionResult<Brand>> {
    const name = input.name.trim();

    const existing = await this.repo.findByName(organizationId, name);
    if (existing) {
      return fail("duplicate_name", `A brand named "${name}" already exists`);
    }

    const brand = await this.repo.create({
      organization_id: organizationId,
      name,
      description: nz(input.description),
      status: input.status ?? "active",
      created_by: userId,
    });

    if (!brand) {
      return fail("unknown", "Failed to create brand. Please try again.");
    }

    return ok(brand);
  }

  // ── Update ─────────────────────────────────────────────────

  async updateBrand(
    brandId: string,
    input: UpdateBrandInput,
    organizationId: string,
    userId: string
  ): Promise<BrandActionResult<Brand>> {
    if (input.name !== undefined && input.name.trim() !== "") {
      const name = input.name.trim();
      const existing = await this.repo.findByName(organizationId, name);
      if (existing && existing.id !== brandId) {
        return fail("duplicate_name", `A brand named "${name}" already exists`);
      }
    }

    const brand = await this.repo.update(
      brandId,
      buildUpdatePatch(input),
      userId
    );

    if (!brand) {
      return fail("not_found", "Brand not found or update failed");
    }

    return ok(brand);
  }

  // ── Archive (soft delete) ──────────────────────────────────

  async archiveBrand(
    brandId: string,
    userId: string
  ): Promise<BrandActionResult<void>> {
    const existing = await this.repo.findById(brandId);
    if (!existing) {
      return fail("not_found", "Brand not found");
    }

    const archived = await this.repo.softDelete(brandId, userId);
    if (!archived) {
      return fail("unknown", "Failed to archive brand. Please try again.");
    }
    return ok(undefined);
  }
}

// ─────────────────────────────────────────────────────────────
// Patch builder — only includes provided fields, mapped to snake_case
// ─────────────────────────────────────────────────────────────

function buildUpdatePatch(input: UpdateBrandInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (input.name !== undefined && input.name.trim() !== "") {
    patch.name = input.name.trim();
  }
  if (input.description !== undefined) {
    patch.description = nz(input.description);
  }
  if (input.status !== undefined) {
    patch.status = input.status;
  }
  return patch;
}
