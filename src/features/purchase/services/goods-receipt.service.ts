import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { GoodsReceiptRepository } from "@/features/purchase/repositories/goods-receipt.repository";
import { PurchaseOrderRepository } from "@/features/purchase/repositories/purchase-order.repository";
import { InventoryRepository } from "@/features/inventory/repositories/inventory.repository";
import type {
  CreateGoodsReceiptInput,
  GoodsReceiptActionResult,
  GoodsReceiptError,
  GoodsReceiptErrorCode,
  GoodsReceiptListParams,
  GoodsReceiptListResult,
  GoodsReceiptWithItems,
} from "@/features/purchase/types/goods-receipt.types";
import type {
  PurchaseOrderItem,
  PurchaseOrderStatus,
  PurchaseOrderWithItems,
} from "@/features/purchase/types/purchase-order.types";

type DbGoodsReceiptItemInsert =
  Database["public"]["Tables"]["goods_receipt_items"]["Insert"];

/** Purchase order statuses from which goods may be received. */
const RECEIVABLE_STATUSES: ReadonlySet<PurchaseOrderStatus> = new Set([
  "approved",
  "ordered",
  "partially_received",
]);

function ok<T>(data: T): GoodsReceiptActionResult<T> {
  return { success: true, data };
}

function fail(
  code: GoodsReceiptErrorCode,
  message: string
): GoodsReceiptActionResult<never> {
  const error: GoodsReceiptError = { code, message };
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

export class GoodsReceiptService {
  private readonly repo: GoodsReceiptRepository;
  private readonly poRepo: PurchaseOrderRepository;
  private readonly inventoryRepo: InventoryRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new GoodsReceiptRepository(supabase);
    this.poRepo = new PurchaseOrderRepository(supabase);
    this.inventoryRepo = new InventoryRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listGoodsReceipts(
    organizationId: string,
    params?: GoodsReceiptListParams
  ): Promise<GoodsReceiptListResult> {
    return this.repo.list(organizationId, params);
  }

  async getGoodsReceipt(
    id: string
  ): Promise<GoodsReceiptActionResult<GoodsReceiptWithItems>> {
    const receipt = await this.repo.findWithItems(id);
    if (!receipt) {
      return fail("not_found", "Goods receipt not found");
    }
    return ok(receipt);
  }

  // ── Create ─────────────────────────────────────────────────

  /**
   * Records a goods receipt against a purchase order. On success this:
   *   1. inserts the GRN header (status "completed") and its line items,
   *   2. writes one atomic inventory `purchase` event per received line
   *      (increases stock via the shared RPC),
   *   3. bumps each matching `purchase_order_items.received_quantity`,
   *   4. recomputes and advances the parent PO status
   *      (completed when every line is fully received, else partially_received).
   */
  async createGoodsReceipt(
    input: CreateGoodsReceiptInput,
    organizationId: string,
    userId: string
  ): Promise<GoodsReceiptActionResult<GoodsReceiptWithItems>> {
    const po = await this.poRepo.findWithItems(input.purchaseOrderId);
    if (!po || po.organizationId !== organizationId) {
      return fail("not_found", "Purchase order not found");
    }
    if (!RECEIVABLE_STATUSES.has(po.status)) {
      return fail(
        "invalid_status",
        "Goods can only be received against an approved, ordered or partially received purchase order."
      );
    }

    // Index PO lines so each received line can be validated and priced.
    const poItemsById = new Map<string, PurchaseOrderItem>(
      po.items.map((item) => [item.id, item])
    );

    const receivableLines = input.items.filter(
      (line) => line.receivedQuantity > 0 || (line.rejectedQuantity ?? 0) > 0
    );
    if (receivableLines.length === 0) {
      return fail("validation", "Record a quantity for at least one line.");
    }

    for (const line of receivableLines) {
      if (!poItemsById.has(line.purchaseOrderItemId)) {
        return fail(
          "validation",
          "A received line does not belong to this purchase order."
        );
      }
    }

    const grnNumber = await this.nextGrnNumber(organizationId);

    const header = await this.repo.createHeader({
      organization_id: organizationId,
      grn_number: grnNumber,
      purchase_order_id: po.id,
      warehouse_id: input.warehouseId,
      received_date:
        nz(input.receivedDate) ?? new Date().toISOString().slice(0, 10),
      status: "completed",
      notes: nz(input.notes),
      created_by: userId,
    });

    if (!header) {
      return fail("unknown", "Failed to create goods receipt. Please try again.");
    }

    const itemRows: DbGoodsReceiptItemInsert[] = receivableLines.map((line) => {
      const poItem = poItemsById.get(line.purchaseOrderItemId);
      return {
        organization_id: organizationId,
        goods_receipt_id: header.id,
        purchase_order_item_id: line.purchaseOrderItemId,
        product_id: line.productId,
        ordered_quantity: poItem ? poItem.quantity : 0,
        received_quantity: line.receivedQuantity,
        rejected_quantity: line.rejectedQuantity ?? 0,
        batch_id: nz(line.batchId),
        created_by: userId,
      };
    });

    const itemsInserted = await this.repo.insertItems(itemRows);
    if (!itemsInserted) {
      return fail("unknown", "Failed to save received line items. Please try again.");
    }

    // 1) Inventory: one atomic `purchase` event per received line.
    for (const line of receivableLines) {
      if (line.receivedQuantity <= 0) {
        continue;
      }
      const { error } = await this.inventoryRepo.adjustStockRpc({
        p_organization_id: organizationId,
        p_product_id: line.productId,
        p_warehouse_id: input.warehouseId,
        p_quantity: line.receivedQuantity,
        p_type: "purchase",
        p_reference_type: "goods_receipt",
        p_reference_id: header.id,
        p_batch_id: nz(line.batchId),
      });
      if (error) {
        return fail(
          "unknown",
          `Failed to update stock for a received line: ${error.message}`
        );
      }
    }

    // 2) Bump each PO line's received_quantity.
    for (const line of receivableLines) {
      if (line.receivedQuantity > 0) {
        await this.repo.bumpPoItemReceived(
          line.purchaseOrderItemId,
          line.receivedQuantity
        );
      }
    }

    // 3) Recompute + advance the PO status from fresh line data.
    await this.advancePurchaseOrderStatus(po, userId);

    const full = await this.repo.findWithItems(header.id);
    return ok(full ?? { ...header, items: [] });
  }

  // ── Helpers ────────────────────────────────────────────────

  /**
   * Re-reads the PO line items (post-bump) and sets the PO status:
   *   - every line received >= ordered → "completed"
   *   - otherwise (some received)      → "partially_received"
   */
  private async advancePurchaseOrderStatus(
    po: PurchaseOrderWithItems,
    userId: string
  ): Promise<void> {
    const items = await this.poRepo.findItems(po.id);
    if (items.length === 0) {
      return;
    }
    const fullyReceived = items.every(
      (item) => item.receivedQuantity >= item.quantity
    );
    const nextStatus: PurchaseOrderStatus = fullyReceived
      ? "completed"
      : "partially_received";

    if (nextStatus !== po.status) {
      await this.repo.setPoStatus(po.id, nextStatus, userId);
    }
  }

  /** Generates the next sequential GRN number: `GRN-#####`. */
  private async nextGrnNumber(organizationId: string): Promise<string> {
    const { total } = await this.repo.list(organizationId, { pageSize: 1 });
    return `GRN-${String(total + 1).padStart(5, "0")}`;
  }
}
