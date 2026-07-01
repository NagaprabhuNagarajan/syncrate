"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SearchService } from "@/features/search/services/search.service";
import {
  EMPTY_SEARCH_RESULTS,
  type SearchResults,
} from "@/features/search/types/search.types";

/**
 * Command-palette global search. Runs server-side against the authenticated
 * Supabase client; RLS scopes results to the caller's organization(s).
 */
export async function globalSearchAction(
  query: string
): Promise<SearchResults> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return EMPTY_SEARCH_RESULTS;
  }

  const service = new SearchService(supabase);
  return service.search(query);
}
