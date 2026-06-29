import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  BusinessProfile,
  BusinessPublicProfile,
  BusinessSearchResult,
} from "@/features/cbn/types/cbn.types";

type DbProfileRow = Database["public"]["Tables"]["business_profiles"]["Row"];

type DbSearchRow =
  Database["public"]["Functions"]["search_businesses"]["Returns"][number];

type DbPublicProfileRow =
  Database["public"]["Functions"]["get_business_public_profile"]["Returns"][number];

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapProfileRow(row: DbProfileRow): BusinessProfile {
  return {
    id: row.id,
    organizationId: row.organization_id,
    verificationLevel: row.verification_level,
    trustScore: row.trust_score,
    isDiscoverable: row.is_discoverable,
    catalogEnabled: row.catalog_enabled,
    totalConnections: row.total_connections,
    totalInvoicesSent: row.total_invoices_sent,
    totalInvoicesReceived: row.total_invoices_received,
    totalPosSent: row.total_pos_sent,
    totalPosReceived: row.total_pos_received,
    paymentRating: row.payment_rating,
    deliveryRating: row.delivery_rating,
    disputeScore: row.dispute_score,
    customerRating: row.customer_rating,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
  };
}

function mapSearchRow(row: DbSearchRow): BusinessSearchResult {
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

function mapPublicProfileRow(row: DbPublicProfileRow): BusinessPublicProfile {
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
    website: row.website,
    email: row.email,
    phone: row.phone,
    verificationStatus: row.verification_status,
    verificationLevel: row.verification_level,
    trustScore: row.trust_score,
    catalogEnabled: row.catalog_enabled,
    totalConnections: row.total_connections,
    isConnected: row.is_connected,
    connectionId: row.connection_id,
    connectionStatus: row.connection_status,
  };
}

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export class DiscoveryRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async searchBusinesses(
    query: string,
    limit = 20,
    offset = 0
  ): Promise<BusinessSearchResult[]> {
    const { data, error } = await this.supabase.rpc("search_businesses", {
      p_query: query,
      p_limit: limit,
      p_offset: offset,
    });

    if (error || !data) {return [];}
    return (data as DbSearchRow[]).map(mapSearchRow);
  }

  async getPublicProfile(orgId: string): Promise<BusinessPublicProfile | null> {
    const { data, error } = await this.supabase.rpc(
      "get_business_public_profile",
      { p_organization_id: orgId }
    );

    if (error || !data || (data as DbPublicProfileRow[]).length === 0)
      {return null;}
    return mapPublicProfileRow((data as DbPublicProfileRow[])[0]);
  }

  async getBusinessProfile(orgId: string): Promise<BusinessProfile | null> {
    const { data, error } = await this.supabase
      .from("business_profiles")
      .select("*")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .single();

    if (error || !data) {return null;}
    return mapProfileRow(data);
  }
}
