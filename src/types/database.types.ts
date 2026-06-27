/**
 * Database types hand-crafted from Supabase migrations.
 *
 * These are NOT auto-generated yet — they will be replaced by running:
 *   pnpm db:generate-types
 * once a live Supabase project is connected.
 *
 * Until then, this file is the authoritative TS representation of the schema.
 * Keep in sync with supabase/migrations/*.sql.
 *
 * Each table MUST include a `Relationships` array to satisfy GenericSchema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ─────────────────────────────────────────────────────────────
// Shared audit field types (all timestamps are ISO strings)
//
// NOTE: Must be a `type` alias, not an `interface`. TypeScript evaluates
// `interface X extends Record<string, unknown>` as false because interfaces
// are open (support declaration merging), so they don't satisfy index
// signature constraints in conditional types. Using `type` keeps the
// intersection rows compatible with Supabase's GenericSchema constraint.
// ─────────────────────────────────────────────────────────────

type AuditFields = {
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_by: string | null;
  version: number;
};

// ─────────────────────────────────────────────────────────────
// Row types (all fields, as they come from the DB)
// ─────────────────────────────────────────────────────────────

type UsersRow = AuditFields & {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  status: "active" | "inactive" | "suspended";
  last_login_at: string | null;
};

type OrganizationsRow = AuditFields & {
  id: string;
  name: string;
  slug: string;
  display_name: string | null;
  business_type: string | null;
  gst_number: string | null;
  pan_number: string | null;
  cin_number: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  country: string;
  pincode: string | null;
  logo_url: string | null;
  verification_status:
    | "unverified"
    | "email_verified"
    | "mobile_verified"
    | "gst_verified"
    | "document_verified"
    | "trusted";
  status: "active" | "suspended" | "inactive";
  plan: "free" | "starter" | "professional" | "enterprise";
  plan_expires_at: string | null;
};

type BranchesRow = AuditFields & {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  is_headquarters: boolean;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gst_number: string | null;
  status: "active" | "inactive" | "closed";
};

type CustomersRow = AuditFields & {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  company: string | null;
  gst_number: string | null;
  pan_number: string | null;
  mobile: string | null;
  email: string | null;
  website: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_pincode: string | null;
  billing_country: string;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_pincode: string | null;
  shipping_country: string | null;
  credit_limit: number;
  payment_terms_days: number;
  preferred_payment_method: string | null;
  opening_balance: number;
  status: "active" | "inactive" | "blacklisted" | "archived";
  tags: string[];
  notes: string | null;
};

type SuppliersRow = AuditFields & {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  contact_person: string | null;
  gst_number: string | null;
  pan_number: string | null;
  mobile: string | null;
  email: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  upi_id: string | null;
  payment_terms_days: number;
  opening_balance: number;
  rating: number | null;
  status: "active" | "inactive" | "archived";
  tags: string[];
  notes: string | null;
};

type AuditLogsRow = {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string | null;
  metadata: Json;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

type CustomerLedgerEntriesRow = {
  id: string;
  organization_id: string;
  customer_id: string;
  entry_date: string;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  debit: number;
  credit: number;
  running_balance: number;
  created_at: string;
  created_by: string | null;
};

type SupplierLedgerEntriesRow = {
  id: string;
  organization_id: string;
  supplier_id: string;
  entry_date: string;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  debit: number;
  credit: number;
  running_balance: number;
  created_at: string;
  created_by: string | null;
};

type RolesRow = AuditFields & {
  id: string;
  organization_id: string | null;
  name: string;
  description: string | null;
  is_system: boolean;
};

type PermissionsRow = AuditFields & {
  id: string;
  module: string;
  action: string;
  name: string;
  description: string | null;
};

type RolePermissionsRow = AuditFields & {
  id: string;
  role_id: string;
  permission_id: string;
};

type OrganizationMembersRow = AuditFields & {
  id: string;
  organization_id: string;
  user_id: string;
  role_id: string;
  branch_id: string | null;
  status: "active" | "inactive" | "invited" | "suspended";
  invited_at: string | null;
  joined_at: string | null;
  invited_by: string | null;
};

type OrganizationSettingsRow = AuditFields & {
  id: string;
  organization_id: string;
  currency: string;
  timezone: string;
  date_format: string;
  number_format: string;
  fiscal_year_start_month: number;
  invoice_prefix: string;
  purchase_order_prefix: string;
  quotation_prefix: string;
  payment_prefix: string;
  session_timeout_hours: number;
  enable_gst: boolean;
  enable_multi_currency: boolean;
  enable_approval_workflow: boolean;
};

type FinancialYearsRow = AuditFields & {
  id: string;
  organization_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  status: "active" | "closed" | "locked";
};

type OrganizationInvitationsRow = AuditFields & {
  id: string;
  organization_id: string;
  email: string;
  full_name: string | null;
  role_id: string;
  branch_id: string | null;
  token: string;
  status: "pending" | "accepted" | "declined" | "expired" | "cancelled";
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
};

// ─────────────────────────────────────────────────────────────
// Database interface
// ─────────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      // ── users ──────────────────────────────────────────────
      users: {
        Row: UsersRow;
        Insert: Partial<AuditFields> & {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          status?: "active" | "inactive" | "suspended";
          last_login_at?: string | null;
        };
        Update: Partial<UsersRow>;
        Relationships: never[];
      };

      // ── organizations ──────────────────────────────────────
      organizations: {
        Row: OrganizationsRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          name: string;
          slug: string;
          display_name?: string | null;
          business_type?: string | null;
          gst_number?: string | null;
          pan_number?: string | null;
          cin_number?: string | null;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string;
          pincode?: string | null;
          logo_url?: string | null;
          verification_status?: OrganizationsRow["verification_status"];
          status?: OrganizationsRow["status"];
          plan?: OrganizationsRow["plan"];
          plan_expires_at?: string | null;
        };
        Update: Partial<OrganizationsRow>;
        Relationships: never[];
      };

      // ── branches ──────────────────────────────────────────
      branches: {
        Row: BranchesRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          name: string;
          code: string;
          is_headquarters?: boolean;
          phone?: string | null;
          email?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          pincode?: string | null;
          gst_number?: string | null;
          status?: BranchesRow["status"];
        };
        Update: Partial<BranchesRow>;
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── customers ─────────────────────────────────────────
      customers: {
        Row: CustomersRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          code: string;
          name: string;
          company?: string | null;
          gst_number?: string | null;
          pan_number?: string | null;
          mobile?: string | null;
          email?: string | null;
          website?: string | null;
          billing_address_line1?: string | null;
          billing_address_line2?: string | null;
          billing_city?: string | null;
          billing_state?: string | null;
          billing_pincode?: string | null;
          billing_country?: string;
          shipping_address_line1?: string | null;
          shipping_address_line2?: string | null;
          shipping_city?: string | null;
          shipping_state?: string | null;
          shipping_pincode?: string | null;
          shipping_country?: string | null;
          credit_limit?: number;
          payment_terms_days?: number;
          preferred_payment_method?: string | null;
          opening_balance?: number;
          status?: CustomersRow["status"];
          tags?: string[];
          notes?: string | null;
        };
        Update: Partial<CustomersRow>;
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── suppliers ─────────────────────────────────────────
      suppliers: {
        Row: SuppliersRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          code: string;
          name: string;
          contact_person?: string | null;
          gst_number?: string | null;
          pan_number?: string | null;
          mobile?: string | null;
          email?: string | null;
          website?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          pincode?: string | null;
          country?: string;
          bank_account_name?: string | null;
          bank_account_number?: string | null;
          bank_ifsc?: string | null;
          bank_name?: string | null;
          upi_id?: string | null;
          payment_terms_days?: number;
          opening_balance?: number;
          rating?: number | null;
          status?: SuppliersRow["status"];
          tags?: string[];
          notes?: string | null;
        };
        Update: Partial<SuppliersRow>;
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── audit_logs ────────────────────────────────────────
      audit_logs: {
        Row: AuditLogsRow;
        Insert: {
          id?: string;
          organization_id: string;
          actor_user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          summary?: string | null;
          metadata?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Partial<AuditLogsRow>;
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── customer_ledger_entries ───────────────────────────
      customer_ledger_entries: {
        Row: CustomerLedgerEntriesRow;
        Insert: {
          id?: string;
          organization_id: string;
          customer_id: string;
          entry_date?: string;
          reference_type?: string | null;
          reference_id?: string | null;
          description?: string | null;
          debit?: number;
          credit?: number;
          running_balance?: number;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<CustomerLedgerEntriesRow>;
        Relationships: [
          {
            foreignKeyName: "customer_ledger_entries_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── supplier_ledger_entries ───────────────────────────
      supplier_ledger_entries: {
        Row: SupplierLedgerEntriesRow;
        Insert: {
          id?: string;
          organization_id: string;
          supplier_id: string;
          entry_date?: string;
          reference_type?: string | null;
          reference_id?: string | null;
          description?: string | null;
          debit?: number;
          credit?: number;
          running_balance?: number;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<SupplierLedgerEntriesRow>;
        Relationships: [
          {
            foreignKeyName: "supplier_ledger_entries_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── roles ─────────────────────────────────────────────
      roles: {
        Row: RolesRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id?: string | null;
          name: string;
          description?: string | null;
          is_system?: boolean;
        };
        Update: Partial<RolesRow>;
        Relationships: [
          {
            foreignKeyName: "roles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── permissions ───────────────────────────────────────
      permissions: {
        Row: PermissionsRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          module: string;
          action: string;
          name: string;
          description?: string | null;
        };
        Update: Partial<PermissionsRow>;
        Relationships: never[];
      };

      // ── role_permissions ──────────────────────────────────
      role_permissions: {
        Row: RolePermissionsRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          role_id: string;
          permission_id: string;
        };
        Update: Partial<RolePermissionsRow>;
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "role_permissions_permission_id_fkey";
            columns: ["permission_id"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── organization_members ──────────────────────────────
      organization_members: {
        Row: OrganizationMembersRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          user_id: string;
          role_id: string;
          branch_id?: string | null;
          status?: OrganizationMembersRow["status"];
          invited_at?: string | null;
          joined_at?: string | null;
          invited_by?: string | null;
        };
        Update: Partial<OrganizationMembersRow>;
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── organization_settings ─────────────────────────────
      organization_settings: {
        Row: OrganizationSettingsRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          currency?: string;
          timezone?: string;
          date_format?: string;
          number_format?: string;
          fiscal_year_start_month?: number;
          invoice_prefix?: string;
          purchase_order_prefix?: string;
          quotation_prefix?: string;
          payment_prefix?: string;
          session_timeout_hours?: number;
          enable_gst?: boolean;
          enable_multi_currency?: boolean;
          enable_approval_workflow?: boolean;
        };
        Update: Partial<OrganizationSettingsRow>;
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── financial_years ───────────────────────────────────
      financial_years: {
        Row: FinancialYearsRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          name: string;
          start_date: string;
          end_date: string;
          is_current?: boolean;
          status?: FinancialYearsRow["status"];
        };
        Update: Partial<FinancialYearsRow>;
        Relationships: [
          {
            foreignKeyName: "financial_years_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── organization_invitations ──────────────────────────
      organization_invitations: {
        Row: OrganizationInvitationsRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          email: string;
          full_name?: string | null;
          role_id: string;
          branch_id?: string | null;
          token?: string;
          status?: OrganizationInvitationsRow["status"];
          expires_at?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
        };
        Update: Partial<OrganizationInvitationsRow>;
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_invitations_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_user_organization_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
      is_org_member: {
        Args: { p_organization_id: string };
        Returns: boolean;
      };
      get_user_role_in_org: {
        Args: { p_organization_id: string };
        Returns: string;
      };
      has_permission: {
        Args: { p_organization_id: string; p_permission_name: string };
        Returns: boolean;
      };
      generate_slug: {
        Args: { p_name: string };
        Returns: string;
      };
      get_current_financial_year: {
        Args: { p_start_month: number };
        Returns: { fy_name: string; start_date: string; end_date: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// ─────────────────────────────────────────────────────────────
// Convenience helpers
// ─────────────────────────────────────────────────────────────

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
