"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { BusinessSearchResult } from "@/features/cbn/types/cbn.types";

type DbSearchRow = {
  id: string;
  name: string;
  display_name: string | null;
  business_id: string | null;
  gst_number: string | null;
  business_type: string | null;
  city: string | null;
  state: string | null;
  country: string;
  logo_url: string | null;
  verification_status: string;
  verification_level: number;
  trust_score: number;
  is_connected: boolean;
  connection_status: string | null;
};

function mapRow(row: DbSearchRow): BusinessSearchResult {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    businessId: row.business_id,
    gstNumber: row.gst_number,
    businessType: row.business_type,
    city: row.city,
    state: row.state,
    country: row.country,
    logoUrl: row.logo_url,
    verificationStatus: row.verification_status,
    verificationLevel: row.verification_level,
    trustScore: row.trust_score,
    isConnected: row.is_connected,
    connectionStatus: row.connection_status,
  };
}

async function searchBusinesses(
  query: string,
  limit = 20
): Promise<BusinessSearchResult[]> {
  if (!query.trim()) {return [];}
  const supabase = createClient();
  const { data, error } = await supabase.rpc("search_businesses", {
    p_query: query.trim(),
    p_limit: limit,
    p_offset: 0,
  });
  if (error || !data) {return [];}
  return (data as DbSearchRow[]).map(mapRow);
}

interface UseBusinessDiscoveryOptions {
  readonly query: string;
  readonly limit?: number;
  /** How long to debounce the query before firing (ms). Defaults to 350. */
  readonly debounceMs?: number;
}

/**
 * TanStack Query hook for searching CBN businesses.
 * Results are cached per unique query string.
 */
export function useBusinessDiscovery({
  query,
  limit = 20,
}: UseBusinessDiscoveryOptions) {
  return useQuery({
    queryKey: ["cbn", "discover", query, limit],
    queryFn: () => searchBusinesses(query, limit),
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}
