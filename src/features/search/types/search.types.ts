/** Global (command-palette) search domain types. */

export type SearchEntity = "customer" | "supplier" | "product" | "invoice";

export interface SearchResultItem {
  readonly id: string;
  readonly entity: SearchEntity;
  readonly title: string;
  readonly subtitle: string | null;
  readonly href: string;
}

export interface SearchResults {
  readonly customers: SearchResultItem[];
  readonly suppliers: SearchResultItem[];
  readonly products: SearchResultItem[];
  readonly invoices: SearchResultItem[];
}

export const EMPTY_SEARCH_RESULTS: SearchResults = {
  customers: [],
  suppliers: [],
  products: [],
  invoices: [],
};
