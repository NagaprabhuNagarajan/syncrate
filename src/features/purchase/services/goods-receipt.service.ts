import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Json } from "@/types/database.types";
import { GoodsReceiptRepository } from "@/features/purchase/repositories/goods-receipt.repository";
import { PurchaseOrderRepository } from "@/features/purchase/repositories/purchase-order.repository";
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
} from "@/features/purchase/types/purchase-order.types";

/** One element of the `p_items` JSON array passed to `receive_goods`. */
interface ReceiveGoodsLine {
  readonly purchase_order_item_id: string;
  readonly product_id: string;
  readonly ordered_quantity: number;
  readonly received_quantity: number;
  readonly rejected_quantity: number;
  readonly batch_id: string | null;
}

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

/**
 * Maps a `receive_goods` exception message to a typed error. The RPC encodes
 * the failure kind as a substring of the raised message.
 */
function mapRpcError(message: string): GoodsReceiptActionResult<never> {
  if (message.includes("not_found")) {
    return fail("not_found", "Purchase order not found");
  }
  if (message.includes("invalid_status")) {
    return fail(
      "invalid_status",
      "Goods can only be received against an approved, ordered or partially received purchase order."
    );
  }
  if (
    message.includes("insufficient_stock") ||
    message.includes("negative_stock")
  ) {
    return fail(
      "insufficient_stock",
      "Not enough stock to complete this goods receipt."
    );
  }
  return fail("unknown", "Failed to record goods receipt. Please try again.");
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

  constructor(supabase: AppSupabaseClient) {
    this.repo = new GoodsReceiptRepository(supabase);
    this.poRepo = new PurchaseOrderRepository(supabase);
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
   * Records a goods receipt against a purchase order. Validation that needs the
   * caller's input (line membership, at least one quantity) happens here; the
   * header + items insert, per-line `purchase` stock events, PO received-qty
   * bumps and PO status advance all run inside one transaction via the
   * `receive_goods` RPC. RPC exceptions are mapped back to typed error codes.
   *
   * The acting user is not passed to the RPC: it stamps `created_by` from the
   * Postgres auth context, so `_userId` is accepted only for signature parity
   * with the other create flows.
   */
  async createGoodsReceipt(
    input: CreateGoodsReceiptInput,
    organizationId: string,
    _userId: string
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

    const items: ReceiveGoodsLine[] = receivableLines.map((line) => {
      const poItem = poItemsById.get(line.purchaseOrderItemId);
      return {
        purchase_order_item_id: line.purchaseOrderItemId,
        product_id: line.productId,
        ordered_quantity: poItem ? poItem.quantity : 0,
        received_quantity: line.receivedQuantity,
        rejected_quantity: line.rejectedQuantity ?? 0,
        batch_id: nz(line.batchId),
      };
    });

    const { data, error } = await this.repo.receiveGoodsRpc({
      p_organization_id: organizationId,
      p_purchase_order_id: po.id,
      p_warehouse_id: input.warehouseId,
      p_grn_number: grnNumber,
      p_received_date:
        nz(input.receivedDate) ?? new Date().toISOString().slice(0, 10),
      p_notes: nz(input.notes),
      p_items: items as unknown as Json,
    });

    if (error) {
      return mapRpcError(error.message);
    }
    if (!data) {
      return fail("unknown", "Failed to record goods receipt. Please try again.");
    }

    const full = await this.repo.findWithItems(data);
    if (!full) {
      return fail("unknown", "Goods receipt was recorded but could not be loaded.");
    }
    return ok(full);
  }

  // ── Helpers ────────────────────────────────────────────────

  /** Generates the next sequential GRN number: `GRN-#####`. */
  private async nextGrnNumber(organizationId: string): Promise<string> {
    const { total } = await this.repo.list(organizationId, { pageSize: 1 });
    return `GRN-${String(total + 1).padStart(5, "0")}`;
  }
}
