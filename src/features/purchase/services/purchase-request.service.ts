import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { PurchaseRequestRepository } from "@/features/purchase/repositories/purchase-request.repository";
import { PurchaseOrderService } from "@/features/purchase/services/purchase-order.service";
import type {
  CreatePurchaseOrderInput,
  PurchaseOrderWithItems,
} from "@/features/purchase/types/purchase-order.types";
import type {
  CreatePurchaseRequestInput,
  PurchaseRequest,
  PurchaseRequestActionResult,
  PurchaseRequestError,
  PurchaseRequestErrorCode,
  PurchaseRequestListParams,
  PurchaseRequestListResult,
  PurchaseRequestWithItems,
  UpdatePurchaseRequestInput,
} from "@/features/purchase/types/purchase-request.types";

type DbPurchaseRequestItemInsert =
  Database["public"]["Tables"]["purchase_request_items"]["Insert"];

function ok<T>(data: T): PurchaseRequestActionResult<T> {
  return { success: true, data };
}

function fail(
  code: PurchaseRequestErrorCode,
  message: string
): PurchaseRequestActionResult<never> {
  const error: PurchaseRequestError = { code, message };
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

export class PurchaseRequestService {
  private readonly repo: PurchaseRequestRepository;

  constructor(private readonly supabase: AppSupabaseClient) {
    this.repo = new PurchaseRequestRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listPurchaseRequests(
    organizationId: string,
    params?: PurchaseRequestListParams
  ): Promise<PurchaseRequestListResult> {
    return this.repo.list(organizationId, params);
  }

  async getPurchaseRequest(
    id: string
  ): Promise<PurchaseRequestActionResult<PurchaseRequestWithItems>> {
    const request = await this.repo.findWithItems(id);
    if (!request) {
      return fail("not_found", "Purchase request not found");
    }
    return ok(request);
  }

  // ── Create ─────────────────────────────────────────────────

  async createPurchaseRequest(
    input: CreatePurchaseRequestInput,
    organizationId: string,
    userId: string
  ): Promise<PurchaseRequestActionResult<PurchaseRequestWithItems>> {
    const requestNumber =
      nz(input.requestNumber)?.toUpperCase() ??
      (await this.nextRequestNumber(organizationId));

    const header = await this.repo.createHeader({
      organization_id: organizationId,
      request_number: requestNumber,
      status: "draft",
      warehouse_id: nz(input.warehouseId),
      required_date: nz(input.requiredDate),
      notes: nz(input.notes),
      created_by: userId,
    });

    if (!header) {
      return fail(
        "unknown",
        "Failed to create purchase request. Please try again."
      );
    }

    const itemsInserted = await this.repo.insertItems(
      this.buildItemRows(input.items, organizationId, header.id, userId)
    );

    if (!itemsInserted) {
      // Roll back the orphaned header so we never leave an item-less request.
      await this.repo.softDelete(header.id, userId);
      return fail("unknown", "Failed to save line items. Please try again.");
    }

    const full = await this.repo.findWithItems(header.id);
    return ok(full ?? { ...header, items: [] });
  }

  // ── Update (draft only, optimistic locking) ────────────────

  async updatePurchaseRequest(
    purchaseRequestId: string,
    input: UpdatePurchaseRequestInput,
    organizationId: string,
    userId: string,
    expectedVersion: number
  ): Promise<PurchaseRequestActionResult<PurchaseRequestWithItems>> {
    const existing = await this.repo.findById(purchaseRequestId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Purchase request not found");
    }
    if (existing.status !== "draft") {
      return fail(
        "invalid_status",
        "Only draft purchase requests can be edited."
      );
    }

    const header = await this.repo.updateHeader(
      purchaseRequestId,
      {
        warehouse_id: nz(input.warehouseId),
        required_date: nz(input.requiredDate),
        notes: nz(input.notes),
      },
      userId,
      expectedVersion
    );

    // The header existed and was a draft, so a null result means the version
    // no longer matched — another writer modified the request in the meantime.
    if (!header) {
      return fail(
        "conflict",
        "This purchase request was changed by someone else. Reload and try again."
      );
    }

    const replaced = await this.repo.replaceItems(
      purchaseRequestId,
      this.buildItemRows(
        input.items,
        organizationId,
        purchaseRequestId,
        userId
      )
    );

    if (!replaced) {
      return fail("unknown", "Failed to update line items. Please try again.");
    }

    const full = await this.repo.findWithItems(purchaseRequestId);
    return ok(full ?? { ...header, items: [] });
  }

  // ── Status transitions ─────────────────────────────────────

  async submitPurchaseRequest(
    purchaseRequestId: string,
    organizationId: string,
    userId: string
  ): Promise<PurchaseRequestActionResult<PurchaseRequest>> {
    return this.transition(
      purchaseRequestId,
      organizationId,
      userId,
      (current) => current === "draft",
      "submitted",
      "Only draft purchase requests can be submitted"
    );
  }

  async approvePurchaseRequest(
    purchaseRequestId: string,
    organizationId: string,
    userId: string
  ): Promise<PurchaseRequestActionResult<PurchaseRequest>> {
    return this.transition(
      purchaseRequestId,
      organizationId,
      userId,
      (current) => current === "submitted",
      "approved",
      "Only submitted purchase requests can be approved",
      { approve: true }
    );
  }

  async rejectPurchaseRequest(
    purchaseRequestId: string,
    organizationId: string,
    userId: string,
    reason: string
  ): Promise<PurchaseRequestActionResult<PurchaseRequest>> {
    return this.transition(
      purchaseRequestId,
      organizationId,
      userId,
      (current) => current === "submitted",
      "rejected",
      "Only submitted purchase requests can be rejected",
      { rejectedReason: reason.trim() }
    );
  }

  async cancelPurchaseRequest(
    purchaseRequestId: string,
    organizationId: string,
    userId: string
  ): Promise<PurchaseRequestActionResult<PurchaseRequest>> {
    return this.transition(
      purchaseRequestId,
      organizationId,
      userId,
      (current) => current !== "converted" && current !== "cancelled",
      "cancelled",
      "Converted or already-cancelled purchase requests cannot be cancelled"
    );
  }

  // ── Convert approved request → purchase order ──────────────

  async convertToPurchaseOrder(
    purchaseRequestId: string,
    supplierId: string,
    organizationId: string,
    userId: string
  ): Promise<PurchaseRequestActionResult<PurchaseOrderWithItems>> {
    const existing = await this.repo.findWithItems(purchaseRequestId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Purchase request not found");
    }
    if (existing.status !== "approved") {
      return fail(
        "invalid_status",
        "Only approved purchase requests can be converted into a purchase order"
      );
    }
    if (existing.items.length === 0) {
      return fail("validation", "This purchase request has no line items");
    }

    const poInput: CreatePurchaseOrderInput = {
      supplierId,
      warehouseId: existing.warehouseId ?? undefined,
      notes: existing.notes ?? undefined,
      items: existing.items.map((item) => ({
        productId: item.productId,
        description: item.description ?? undefined,
        quantity: item.quantity,
        unitPrice: item.estimatedPrice,
      })),
    };

    const poResult = await new PurchaseOrderService(
      this.supabase
    ).createPurchaseOrder(poInput, organizationId, userId);

    if (!poResult.success) {
      return fail(
        "unknown",
        "Failed to create the purchase order from this request. Please try again."
      );
    }

    const updated = await this.repo.updateStatus(
      purchaseRequestId,
      "converted",
      userId,
      { convertedPoId: poResult.data.id }
    );

    if (!updated) {
      return fail(
        "unknown",
        "The purchase order was created but the request could not be updated."
      );
    }

    return ok(poResult.data);
  }

  // ── Helpers ────────────────────────────────────────────────

  private async transition(
    purchaseRequestId: string,
    organizationId: string,
    userId: string,
    allowed: (current: PurchaseRequest["status"]) => boolean,
    next: PurchaseRequest["status"],
    invalidMessage: string,
    extra: {
      approve?: boolean;
      rejectedReason?: string;
      convertedPoId?: string;
    } = {}
  ): Promise<PurchaseRequestActionResult<PurchaseRequest>> {
    const existing = await this.repo.findById(purchaseRequestId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Purchase request not found");
    }
    if (!allowed(existing.status)) {
      return fail("invalid_status", invalidMessage);
    }
    const updated = await this.repo.updateStatus(
      purchaseRequestId,
      next,
      userId,
      extra
    );
    if (!updated) {
      return fail(
        "unknown",
        "Failed to update purchase request. Please try again."
      );
    }
    return ok(updated);
  }

  private buildItemRows(
    inputs: readonly CreatePurchaseRequestInput["items"][number][],
    organizationId: string,
    purchaseRequestId: string,
    userId: string
  ): DbPurchaseRequestItemInsert[] {
    return inputs.map((input) => ({
      organization_id: organizationId,
      purchase_request_id: purchaseRequestId,
      product_id: input.productId,
      description: nz(input.description),
      quantity: input.quantity,
      estimated_price: input.estimatedPrice ?? 0,
      created_by: userId,
    }));
  }

  /** Generates the next sequential request number: `PR-#####`. */
  private async nextRequestNumber(organizationId: string): Promise<string> {
    const { total } = await this.repo.list(organizationId, { pageSize: 1 });
    return `PR-${String(total + 1).padStart(5, "0")}`;
  }
}
