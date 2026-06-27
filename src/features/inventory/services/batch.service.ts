import type { AppSupabaseClient } from "@/lib/supabase/types";
import { BatchRepository } from "@/features/inventory/repositories/batch.repository";
import type {
  Batch,
  BatchActionResult,
  BatchError,
  BatchErrorCode,
  BatchListParams,
  BatchListResult,
  CreateBatchInput,
} from "@/features/inventory/types/batch.types";

function ok<T>(data: T): BatchActionResult<T> {
  return { success: true, data };
}

function fail(code: BatchErrorCode, message: string): BatchActionResult<never> {
  const error: BatchError = { code, message };
  return { success: false, error };
}

function nz(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export class BatchService {
  private readonly repo: BatchRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new BatchRepository(supabase);
  }

  async listBatches(
    organizationId: string,
    params?: BatchListParams
  ): Promise<BatchListResult> {
    return this.repo.list(organizationId, params);
  }

  async getBatch(id: string): Promise<BatchActionResult<Batch>> {
    const batch = await this.repo.findById(id);
    if (!batch) {
      return fail("not_found", "Batch not found");
    }
    return ok(batch);
  }

  async createBatch(
    input: CreateBatchInput,
    organizationId: string,
    userId: string
  ): Promise<BatchActionResult<Batch>> {
    const batchNumber = input.batchNumber.trim();

    const existing = await this.repo.findByNumber(input.productId, batchNumber);
    if (existing) {
      return fail(
        "duplicate_number",
        `Batch "${batchNumber}" already exists for this product`
      );
    }

    const remaining = input.remainingQuantity ?? input.receivedQuantity;

    const batch = await this.repo.create({
      organization_id: organizationId,
      product_id: input.productId,
      batch_number: batchNumber,
      manufacturing_date: nz(input.manufacturingDate),
      expiry_date: nz(input.expiryDate),
      supplier_batch: nz(input.supplierBatch),
      received_quantity: input.receivedQuantity,
      remaining_quantity: remaining,
      created_by: userId,
    });

    if (!batch) {
      return fail("unknown", "Failed to create batch. Please try again.");
    }

    return ok(batch);
  }
}
