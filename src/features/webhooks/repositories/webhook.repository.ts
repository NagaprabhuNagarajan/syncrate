import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  WebhookDelivery,
  WebhookEndpoint,
  WebhookEndpointWithSecret,
} from "@/features/webhooks/types/webhook.types";

type DbEndpoint = Database["public"]["Tables"]["webhook_endpoints"]["Row"];
type DbEndpointInsert =
  Database["public"]["Tables"]["webhook_endpoints"]["Insert"];
type DbDelivery = Database["public"]["Tables"]["webhook_deliveries"]["Row"];
type DbDeliveryInsert =
  Database["public"]["Tables"]["webhook_deliveries"]["Insert"];

const DEFAULT_DELIVERY_LIMIT = 20;
const MAX_DELIVERY_LIMIT = 100;

// ─────────────────────────────────────────────────────────────
// Mappers — `mapEndpoint` deliberately omits `secret` so the signing
// material never leaves the repository boundary in read/list paths.
// ─────────────────────────────────────────────────────────────

function mapEndpoint(row: DbEndpoint): WebhookEndpoint {
  return {
    id: row.id,
    organizationId: row.organization_id,
    url: row.url,
    description: row.description,
    eventTypes: row.event_types,
    isActive: row.is_active,
    version: row.version,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
  };
}

function mapEndpointWithSecret(row: DbEndpoint): WebhookEndpointWithSecret {
  return {
    id: row.id,
    organizationId: row.organization_id,
    url: row.url,
    secret: row.secret,
    eventTypes: row.event_types,
    isActive: row.is_active,
  };
}

function mapDelivery(row: DbDelivery): WebhookDelivery {
  return {
    id: row.id,
    organizationId: row.organization_id,
    endpointId: row.endpoint_id,
    eventType: row.event_type,
    status: row.status,
    attempts: row.attempts,
    responseStatus: row.response_status,
    error: row.error,
    createdAt: new Date(row.created_at),
    deliveredAt: row.delivered_at ? new Date(row.delivered_at) : null,
  };
}

// ─────────────────────────────────────────────────────────────
// Endpoint repository
// ─────────────────────────────────────────────────────────────

export class WebhookEndpointRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async listByOrg(organizationId: string): Promise<WebhookEndpoint[]> {
    const { data, error } = await this.supabase
      .from("webhook_endpoints")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }
    return data.map(mapEndpoint);
  }

  async findById(
    id: string,
    organizationId: string
  ): Promise<WebhookEndpoint | null> {
    const { data, error } = await this.supabase
      .from("webhook_endpoints")
      .select("*")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapEndpoint(data);
  }

  /**
   * Server-only projection that carries the signing secret, for use by the
   * dispatch engine. Returns active, non-deleted endpoints subscribed to the
   * given event type.
   */
  async findActiveForDispatch(
    organizationId: string,
    eventType: string
  ): Promise<WebhookEndpointWithSecret[]> {
    const { data, error } = await this.supabase
      .from("webhook_endpoints")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .contains("event_types", [eventType]);

    if (error || !data) {
      return [];
    }
    return data.map(mapEndpointWithSecret);
  }

  /** Server-only projection (with secret) for a single endpoint, e.g. a test send. */
  async findByIdForDispatch(
    id: string,
    organizationId: string
  ): Promise<WebhookEndpointWithSecret | null> {
    const { data, error } = await this.supabase
      .from("webhook_endpoints")
      .select("*")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapEndpointWithSecret(data);
  }

  async create(input: DbEndpointInsert): Promise<WebhookEndpoint | null> {
    const { data, error } = await this.supabase
      .from("webhook_endpoints")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapEndpoint(data);
  }

  /**
   * Optimistic-locked update: only applies when the stored `version` still
   * matches `expectedVersion`, then bumps it. Returns null on conflict/miss.
   */
  async update(
    id: string,
    organizationId: string,
    patch: Partial<DbEndpoint>,
    expectedVersion: number,
    updatedBy: string
  ): Promise<WebhookEndpoint | null> {
    const { data, error } = await this.supabase
      .from("webhook_endpoints")
      .update({
        ...patch,
        version: expectedVersion + 1,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .eq("version", expectedVersion)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapEndpoint(data);
  }

  async softDelete(
    id: string,
    organizationId: string,
    deletedBy: string
  ): Promise<boolean> {
    const now = new Date().toISOString();
    const { error } = await this.supabase
      .from("webhook_endpoints")
      .update({
        deleted_at: now,
        deleted_by: deletedBy,
        is_active: false,
        updated_at: now,
      })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    return !error;
  }
}

// ─────────────────────────────────────────────────────────────
// Delivery repository
// ─────────────────────────────────────────────────────────────

export class WebhookDeliveryRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async listByEndpoint(
    endpointId: string,
    organizationId: string,
    limit = DEFAULT_DELIVERY_LIMIT
  ): Promise<WebhookDelivery[]> {
    const capped = Math.min(MAX_DELIVERY_LIMIT, Math.max(1, limit));
    const { data, error } = await this.supabase
      .from("webhook_deliveries")
      .select("*")
      .eq("endpoint_id", endpointId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(capped);

    if (error || !data) {
      return [];
    }
    return data.map(mapDelivery);
  }

  async create(input: DbDeliveryInsert): Promise<WebhookDelivery | null> {
    const { data, error } = await this.supabase
      .from("webhook_deliveries")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapDelivery(data);
  }
}
