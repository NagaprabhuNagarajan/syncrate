import type { AppSupabaseClient } from "@/lib/supabase/types";
import { InvoiceLineRepository } from "@/features/cbn/repositories/invoice-line.repository";
import { ProductLinkRepository } from "@/features/cbn/repositories/product-link.repository";
import { ProductRepository } from "@/features/product/repositories/product.repository";
import type {
  CbnActionResult,
  CbnDocumentKind,
  ResolvedInvoiceLine,
} from "@/features/cbn/types/cbn.types";

/**
 * Matches each line of an incoming synced document to a product in the
 * RECEIVING organization's catalog. Shared by both directions: an invoice the
 * buyer receives and a purchase order the supplier receives differ only in
 * which payload table the lines came from.
 *
 * Precedence is deliberate — strongest evidence first:
 *   1. a mapping the user already confirmed for this connection
 *   2. barcode (EAN/UPC), the only identifier with real cross-org meaning
 *   3. SKU, which is namespaced per organization and so only a weak hint
 *
 * Name and HSN are NOT matched on: HSN is a tax class shared by whole product
 * families, and names collide across brands. Binding the wrong product silently
 * corrupts stock and cost history, so anything short of an exact identifier is
 * left for the user to decide.
 */
export async function resolveDocumentLines(
  supabase: AppSupabaseClient,
  documentId: string,
  receivingOrgId: string,
  connectionId: string,
  kind: CbnDocumentKind
): Promise<CbnActionResult<readonly ResolvedInvoiceLine[]>> {
  const lines = await new InvoiceLineRepository(supabase).listByCbnInvoice(
    documentId,
    kind
  );

  // Null means the read failed, which is a very different problem from a
  // document that legitimately carries no lines — say so instead of showing
  // "ask the sender to resend" for a local fault.
  if (lines === null) {
    return {
      success: false,
      error: {
        code: "unknown",
        message:
          "Could not read the line items for this document. The payload table may be missing (migrations 20260721000001 / 20260721000002 not applied) or blocked by RLS.",
      },
    };
  }

  if (lines.length === 0) {
    return { success: true, data: [] };
  }

  const links = await new ProductLinkRepository(supabase).findForConnection(
    receivingOrgId,
    connectionId,
    lines
      .map((line) => line.supplierProductId)
      .filter((id): id is string => id !== null)
  );

  const products = new ProductRepository(supabase);

  const resolved = await Promise.all(
    lines.map(async (line): Promise<ResolvedInvoiceLine> => {
      const linkedId = line.supplierProductId
        ? links.get(line.supplierProductId)
        : undefined;

      if (linkedId) {
        const product = await products.findById(linkedId);
        // A remembered link can point at a since-deleted product; fall through
        // to identifier matching rather than offering a dead id.
        if (product) {
          return {
            line,
            productId: product.id,
            productName: product.name,
            matchedBy: "link",
          };
        }
      }

      if (line.productBarcode) {
        const match = await products.findByField(
          receivingOrgId,
          "barcode",
          line.productBarcode
        );
        if (match) {
          return {
            line,
            productId: match.id,
            productName: match.name,
            matchedBy: "barcode",
          };
        }
      }

      if (line.productSku) {
        const match = await products.findByField(
          receivingOrgId,
          "sku",
          line.productSku
        );
        if (match) {
          return {
            line,
            productId: match.id,
            productName: match.name,
            matchedBy: "sku",
          };
        }
      }

      return { line, productId: null, productName: null, matchedBy: "none" };
    })
  );

  return { success: true, data: resolved };
}
