import type { AppSupabaseClient } from "@/lib/supabase/types";
import {
  EMPTY_SEARCH_RESULTS,
  type SearchResultItem,
  type SearchResults,
} from "@/features/search/types/search.types";

/** Minimum query length before we hit the database. */
export const MIN_QUERY_LENGTH = 2;

/** Max rows returned per entity group. */
const PER_ENTITY_LIMIT = 5;

/**
 * Cross-domain search used by the command palette. Queries customers,
 * suppliers, products and invoices in parallel. Tenant isolation is enforced
 * by RLS on every table, so results are naturally scoped to the caller's
 * organization(s) — no explicit organization_id filter is required here.
 */
export class SearchService {
  constructor(private readonly supabase: AppSupabaseClient) {}

  /**
   * Strips characters that would break PostgREST's `or()` filter grammar
   * (commas, parentheses, wildcards, backslashes) so user input can be
   * embedded safely in an `ilike` pattern.
   */
  private sanitize(query: string): string {
    return query
      .trim()
      .replace(/[,()*%\\]/g, "")
      .slice(0, 100);
  }

  async search(rawQuery: string): Promise<SearchResults> {
    const q = this.sanitize(rawQuery);
    if (q.length < MIN_QUERY_LENGTH) {
      return EMPTY_SEARCH_RESULTS;
    }

    // PostgREST or() uses `*` as the ilike wildcard.
    const p = `*${q}*`;

    const [customers, suppliers, products, invoices] = await Promise.all([
      this.supabase
        .from("customers")
        .select("id,name,code,email")
        .is("deleted_at", null)
        .or(`name.ilike.${p},code.ilike.${p},email.ilike.${p}`)
        .limit(PER_ENTITY_LIMIT),
      this.supabase
        .from("suppliers")
        .select("id,name,code,email")
        .is("deleted_at", null)
        .or(`name.ilike.${p},code.ilike.${p},email.ilike.${p}`)
        .limit(PER_ENTITY_LIMIT),
      this.supabase
        .from("products")
        .select("id,name,code,sku")
        .is("deleted_at", null)
        .or(`name.ilike.${p},code.ilike.${p},sku.ilike.${p}`)
        .limit(PER_ENTITY_LIMIT),
      this.supabase
        .from("invoices")
        .select("id,invoice_number,reference_number")
        .is("deleted_at", null)
        .or(`invoice_number.ilike.${p},reference_number.ilike.${p}`)
        .limit(PER_ENTITY_LIMIT),
    ]);

    const toItem = (
      entity: SearchResultItem["entity"],
      id: string,
      title: string,
      subtitle: string | null,
      hrefBase: string
    ): SearchResultItem => ({
      id,
      entity,
      title,
      subtitle,
      href: `${hrefBase}/${id}`,
    });

    return {
      customers: (customers.data ?? []).map((r) =>
        toItem("customer", r.id, r.name, r.code, "/customers")
      ),
      suppliers: (suppliers.data ?? []).map((r) =>
        toItem("supplier", r.id, r.name, r.code, "/suppliers")
      ),
      products: (products.data ?? []).map((r) =>
        toItem("product", r.id, r.name, r.sku ?? r.code, "/products")
      ),
      invoices: (invoices.data ?? []).map((r) =>
        toItem(
          "invoice",
          r.id,
          r.invoice_number,
          r.reference_number,
          "/invoices"
        )
      ),
    };
  }
}
