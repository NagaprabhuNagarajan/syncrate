import type { AppSupabaseClient } from "@/lib/supabase/types";
import { InventoryRepository } from "@/features/inventory/repositories/inventory.repository";
import type {
  AdjustStockInput,
  InventoryActionResult,
  InventoryError,
  InventoryErrorCode,
  InventoryLevelListParams,
  InventoryLevelListResult,
  InventoryTransaction,
  InventoryTransactionListParams,
  OpeningStockInput,
  TransferStockInput,
} from "@/features/inventory/types/inventory.types";

function ok<T>(data: T): InventoryActionResult<T> {
  return { success: true, data };
}

function fail(
  code: InventoryErrorCode,
  message: string
): InventoryActionResult<never> {
  const error: InventoryError = { code, message };
  return { success: false, error };
}

/**
 * Translates an atomic-RPC error message into a typed inventory error. The
 * Postgres functions raise exceptions whose messages carry a stable token
 * (e.g. `negative_stock`); we match on that token to pick the error code.
 */
function mapRpcError(message: string): InventoryActionResult<never> {
  if (message.includes("negative_stock")) {
    return fail("negative_stock", "This change would drive stock below zero.");
  }
  if (message.includes("insufficient_stock")) {
    return fail(
      "insufficient_stock",
      "The source warehouse does not hold enough stock for this transfer."
    );
  }
  if (message.includes("same_warehouse")) {
    return fail(
      "same_warehouse",
      "Source and destination warehouses must be different."
    );
  }
  if (message.includes("invalid_quantity")) {
    return fail("validation", "Quantity is invalid.");
  }
  return fail("unknown", "Something went wrong. Please try again.");
}

function nz(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export class InventoryService {
  private readonly repo: InventoryRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new InventoryRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listLevels(
    organizationId: string,
    params?: InventoryLevelListParams
  ): Promise<InventoryLevelListResult> {
    return this.repo.listLevels(organizationId, params);
  }

  async listTransactions(
    organizationId: string,
    params?: InventoryTransactionListParams
  ): Promise<InventoryTransaction[]> {
    return this.repo.listTransactions(organizationId, params);
  }

  /** Total stock value (Σ quantity × purchase price) across all levels. */
  async getStockValue(organizationId: string): Promise<number> {
    const { items } = await this.repo.listLevels(organizationId, {
      pageSize: 100,
    });
    return items.reduce(
      (total, item) => total + item.quantity * item.purchasePrice,
      0
    );
  }

  // ── Adjustment event ───────────────────────────────────────

  /**
   * Applies a signed stock adjustment via the atomic `adjust_stock` RPC, which
   * writes ONE immutable ledger row (`adjustment` for increases, `damage` for
   * decreases) and updates the snapshot in a single Postgres transaction. The
   * RPC raises `negative_stock` if the result would drive stock negative.
   * Returns the new snapshot quantity on success.
   */
  async adjustStock(
    input: AdjustStockInput,
    organizationId: string,
    _userId: string
  ): Promise<InventoryActionResult<number>> {
    if (input.quantity === 0) {
      return fail("validation", "Quantity cannot be zero");
    }

    const type = input.quantity < 0 ? "damage" : "adjustment";

    const { data, error } = await this.repo.adjustStockRpc({
      p_organization_id: organizationId,
      p_product_id: input.productId,
      p_warehouse_id: input.warehouseId,
      p_quantity: input.quantity,
      p_type: type,
      p_note: nz(input.reason),
      p_reference_type: "manual",
    });

    if (error) {
      return mapRpcError(error.message);
    }
    if (data === null) {
      return fail("unknown", "Failed to record adjustment. Please try again.");
    }

    return ok(data);
  }

  // ── Transfer event ─────────────────────────────────────────

  /**
   * Moves stock between two warehouses via the atomic `transfer_stock` RPC,
   * which writes BOTH immutable ledger rows (`transfer_out` at the source,
   * `transfer_in` at the destination) and updates both snapshots in a single
   * Postgres transaction. The RPC raises `invalid_quantity`, `same_warehouse`,
   * or `insufficient_stock` as appropriate.
   */
  async transferStock(
    input: TransferStockInput,
    organizationId: string,
    _userId: string
  ): Promise<InventoryActionResult<void>> {
    if (input.quantity <= 0) {
      return fail("validation", "Quantity must be greater than zero");
    }
    if (input.fromWarehouseId === input.toWarehouseId) {
      return fail(
        "same_warehouse",
        "Source and destination warehouses must be different"
      );
    }

    const { error } = await this.repo.transferStockRpc({
      p_organization_id: organizationId,
      p_product_id: input.productId,
      p_from_warehouse_id: input.fromWarehouseId,
      p_to_warehouse_id: input.toWarehouseId,
      p_quantity: input.quantity,
      p_note: nz(input.note),
    });

    if (error) {
      return mapRpcError(error.message);
    }

    return ok(undefined);
  }

  // ── Opening stock helper ───────────────────────────────────

  /**
   * Records opening stock for a (product, warehouse) pair via the atomic
   * `adjust_stock` RPC with type `opening`. Returns the new snapshot quantity.
   */
  async setOpeningStock(
    input: OpeningStockInput,
    organizationId: string,
    _userId: string
  ): Promise<InventoryActionResult<number>> {
    if (input.quantity < 0) {
      return fail("validation", "Opening quantity cannot be negative");
    }

    const { data, error } = await this.repo.adjustStockRpc({
      p_organization_id: organizationId,
      p_product_id: input.productId,
      p_warehouse_id: input.warehouseId,
      p_quantity: input.quantity,
      p_type: "opening",
      p_note: nz(input.note),
      p_reference_type: "opening",
    });

    if (error) {
      return mapRpcError(error.message);
    }
    if (data === null) {
      return fail(
        "unknown",
        "Failed to record opening stock. Please try again."
      );
    }

    return ok(data);
  }

  // ── Helpers ────────────────────────────────────────────────

  /** Convenience used by callers needing the current quantity (defaults 0). */
  async getCurrentQuantity(
    productId: string,
    warehouseId: string
  ): Promise<number> {
    const level = await this.repo.getLevel(productId, warehouseId);
    return level?.quantity ?? 0;
  }
}
