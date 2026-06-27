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

type CategoriesRow = AuditFields & {
  id: string;
  organization_id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  status: "active" | "archived";
};

type BrandsRow = AuditFields & {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
};

type UnitsRow = AuditFields & {
  id: string;
  organization_id: string;
  name: string;
  symbol: string;
  status: "active" | "archived";
};

type ProductsRow = AuditFields & {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description: string | null;
  type: "inventory" | "service" | "digital" | "bundle";
  status: "draft" | "active" | "discontinued" | "archived";
  category_id: string | null;
  brand_id: string | null;
  unit_id: string | null;
  manufacturer: string | null;
  hsn_code: string | null;
  gst_rate: number;
  tax_inclusive: boolean;
  purchase_price: number;
  selling_price: number;
  dealer_price: number;
  wholesale_price: number;
  retail_price: number;
  min_selling_price: number;
  sku: string | null;
  barcode: string | null;
  qr_code: string | null;
  track_inventory: boolean;
  reorder_level: number;
  max_stock: number;
  opening_stock: number;
  preferred_supplier_id: string | null;
  is_seasonal: boolean;
  is_fast_moving: boolean;
  is_slow_moving: boolean;
  ai_tags: string[];
  tags: string[];
};

type WarehousesRow = AuditFields & {
  id: string;
  organization_id: string;
  branch_id: string | null;
  code: string;
  name: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  capacity: number | null;
  is_default: boolean;
  status: "active" | "inactive" | "archived";
};

type BatchesRow = AuditFields & {
  id: string;
  organization_id: string;
  product_id: string;
  batch_number: string;
  manufacturing_date: string | null;
  expiry_date: string | null;
  supplier_batch: string | null;
  received_quantity: number;
  remaining_quantity: number;
  status: "active" | "expired" | "depleted";
};

type InventoryRow = {
  id: string;
  organization_id: string;
  product_id: string;
  warehouse_id: string;
  quantity: number;
  reserved_quantity: number;
  created_at: string;
  updated_at: string;
};

type InventoryTransactionsRow = {
  id: string;
  organization_id: string;
  product_id: string;
  warehouse_id: string;
  batch_id: string | null;
  type:
    | "opening"
    | "purchase"
    | "sale"
    | "sales_return"
    | "purchase_return"
    | "transfer_in"
    | "transfer_out"
    | "adjustment"
    | "damage"
    | "expiry"
    | "production"
    | "consumption";
  quantity: number;
  running_balance: number;
  reference_type: string | null;
  reference_id: string | null;
  note: string | null;
  created_at: string;
  created_by: string | null;
};

type SerialNumbersRow = AuditFields & {
  id: string;
  organization_id: string;
  product_id: string;
  warehouse_id: string | null;
  batch_id: string | null;
  serial_number: string;
  status: "in_stock" | "reserved" | "sold" | "returned" | "damaged";
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
};

type PurchaseOrdersRow = AuditFields & {
  id: string;
  organization_id: string;
  po_number: string;
  supplier_id: string;
  warehouse_id: string | null;
  status:
    | "draft"
    | "submitted"
    | "approved"
    | "ordered"
    | "partially_received"
    | "completed"
    | "cancelled";
  order_date: string;
  expected_delivery_date: string | null;
  currency: string;
  notes: string | null;
  terms: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  approved_by: string | null;
  approved_at: string | null;
};

type PurchaseOrderItemsRow = {
  id: string;
  organization_id: string;
  purchase_order_id: string;
  product_id: string;
  description: string | null;
  quantity: number;
  received_quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  created_at: string;
  created_by: string | null;
};

type GoodsReceiptsRow = AuditFields & {
  id: string;
  organization_id: string;
  grn_number: string;
  purchase_order_id: string;
  warehouse_id: string;
  received_date: string;
  status: "draft" | "completed";
  notes: string | null;
};

type GoodsReceiptItemsRow = {
  id: string;
  organization_id: string;
  goods_receipt_id: string;
  purchase_order_item_id: string | null;
  product_id: string;
  ordered_quantity: number;
  received_quantity: number;
  rejected_quantity: number;
  batch_id: string | null;
  created_at: string;
  created_by: string | null;
};

type PurchaseInvoicesRow = AuditFields & {
  id: string;
  organization_id: string;
  invoice_number: string;
  supplier_invoice_number: string | null;
  purchase_order_id: string | null;
  supplier_id: string;
  invoice_date: string;
  due_date: string | null;
  status: "draft" | "posted" | "cancelled";
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  notes: string | null;
  posted_at: string | null;
  posted_by: string | null;
};

type PurchaseInvoiceItemsRow = {
  id: string;
  organization_id: string;
  purchase_invoice_id: string;
  product_id: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  created_at: string;
  created_by: string | null;
};

type PurchaseReturnsRow = AuditFields & {
  id: string;
  organization_id: string;
  return_number: string;
  purchase_order_id: string | null;
  supplier_id: string;
  warehouse_id: string | null;
  return_date: string;
  reason: "damaged" | "wrong_item" | "expired" | "quality_issue" | "other";
  status: "draft" | "completed" | "cancelled";
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
};

type PurchaseReturnItemsRow = {
  id: string;
  organization_id: string;
  purchase_return_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  batch_id: string | null;
  created_at: string;
  created_by: string | null;
};

type PurchaseRequestsRow = AuditFields & {
  id: string;
  organization_id: string;
  request_number: string;
  status:
    | "draft"
    | "submitted"
    | "approved"
    | "rejected"
    | "converted"
    | "cancelled";
  warehouse_id: string | null;
  required_date: string | null;
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  converted_po_id: string | null;
};

type PurchaseRequestItemsRow = {
  id: string;
  organization_id: string;
  purchase_request_id: string;
  product_id: string;
  description: string | null;
  quantity: number;
  estimated_price: number;
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

      // ── categories ────────────────────────────────────────
      categories: {
        Row: CategoriesRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          parent_id?: string | null;
          name: string;
          description?: string | null;
          status?: CategoriesRow["status"];
        };
        Update: Partial<CategoriesRow>;
        Relationships: [
          {
            foreignKeyName: "categories_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── brands ────────────────────────────────────────────
      brands: {
        Row: BrandsRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          status?: BrandsRow["status"];
        };
        Update: Partial<BrandsRow>;
        Relationships: [
          {
            foreignKeyName: "brands_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── units ─────────────────────────────────────────────
      units: {
        Row: UnitsRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          name: string;
          symbol: string;
          status?: UnitsRow["status"];
        };
        Update: Partial<UnitsRow>;
        Relationships: [
          {
            foreignKeyName: "units_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── products ──────────────────────────────────────────
      products: {
        Row: ProductsRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          code: string;
          name: string;
          description?: string | null;
          type?: ProductsRow["type"];
          status?: ProductsRow["status"];
          category_id?: string | null;
          brand_id?: string | null;
          unit_id?: string | null;
          manufacturer?: string | null;
          hsn_code?: string | null;
          gst_rate?: number;
          tax_inclusive?: boolean;
          purchase_price?: number;
          selling_price?: number;
          dealer_price?: number;
          wholesale_price?: number;
          retail_price?: number;
          min_selling_price?: number;
          sku?: string | null;
          barcode?: string | null;
          qr_code?: string | null;
          track_inventory?: boolean;
          reorder_level?: number;
          max_stock?: number;
          opening_stock?: number;
          preferred_supplier_id?: string | null;
          is_seasonal?: boolean;
          is_fast_moving?: boolean;
          is_slow_moving?: boolean;
          ai_tags?: string[];
          tags?: string[];
        };
        Update: Partial<ProductsRow>;
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── warehouses ────────────────────────────────────────
      warehouses: {
        Row: WarehousesRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          branch_id?: string | null;
          code: string;
          name: string;
          address_line1?: string | null;
          city?: string | null;
          state?: string | null;
          pincode?: string | null;
          capacity?: number | null;
          is_default?: boolean;
          status?: WarehousesRow["status"];
        };
        Update: Partial<WarehousesRow>;
        Relationships: [
          {
            foreignKeyName: "warehouses_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── batches ───────────────────────────────────────────
      batches: {
        Row: BatchesRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          product_id: string;
          batch_number: string;
          manufacturing_date?: string | null;
          expiry_date?: string | null;
          supplier_batch?: string | null;
          received_quantity?: number;
          remaining_quantity?: number;
          status?: BatchesRow["status"];
        };
        Update: Partial<BatchesRow>;
        Relationships: [
          {
            foreignKeyName: "batches_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── inventory ─────────────────────────────────────────
      inventory: {
        Row: InventoryRow;
        Insert: {
          id?: string;
          organization_id: string;
          product_id: string;
          warehouse_id: string;
          quantity?: number;
          reserved_quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<InventoryRow>;
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── inventory_transactions ────────────────────────────
      inventory_transactions: {
        Row: InventoryTransactionsRow;
        Insert: {
          id?: string;
          organization_id: string;
          product_id: string;
          warehouse_id: string;
          batch_id?: string | null;
          type: InventoryTransactionsRow["type"];
          quantity: number;
          running_balance?: number;
          reference_type?: string | null;
          reference_id?: string | null;
          note?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<InventoryTransactionsRow>;
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── serial_numbers ────────────────────────────────────
      serial_numbers: {
        Row: SerialNumbersRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          product_id: string;
          warehouse_id?: string | null;
          batch_id?: string | null;
          serial_number: string;
          status?: SerialNumbersRow["status"];
          reference_type?: string | null;
          reference_id?: string | null;
          notes?: string | null;
        };
        Update: Partial<SerialNumbersRow>;
        Relationships: [
          {
            foreignKeyName: "serial_numbers_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── purchase_orders ───────────────────────────────────
      purchase_orders: {
        Row: PurchaseOrdersRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          po_number: string;
          supplier_id: string;
          warehouse_id?: string | null;
          status?: PurchaseOrdersRow["status"];
          order_date?: string;
          expected_delivery_date?: string | null;
          currency?: string;
          notes?: string | null;
          terms?: string | null;
          subtotal?: number;
          discount_amount?: number;
          tax_amount?: number;
          total_amount?: number;
          approved_by?: string | null;
          approved_at?: string | null;
        };
        Update: Partial<PurchaseOrdersRow>;
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── purchase_order_items ──────────────────────────────
      purchase_order_items: {
        Row: PurchaseOrderItemsRow;
        Insert: {
          id?: string;
          organization_id: string;
          purchase_order_id: string;
          product_id: string;
          description?: string | null;
          quantity: number;
          received_quantity?: number;
          unit_price?: number;
          discount_percent?: number;
          tax_rate?: number;
          tax_amount?: number;
          line_total?: number;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<PurchaseOrderItemsRow>;
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── goods_receipts ────────────────────────────────────
      goods_receipts: {
        Row: GoodsReceiptsRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          grn_number: string;
          purchase_order_id: string;
          warehouse_id: string;
          received_date?: string;
          status?: GoodsReceiptsRow["status"];
          notes?: string | null;
        };
        Update: Partial<GoodsReceiptsRow>;
        Relationships: [
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── goods_receipt_items ───────────────────────────────
      goods_receipt_items: {
        Row: GoodsReceiptItemsRow;
        Insert: {
          id?: string;
          organization_id: string;
          goods_receipt_id: string;
          purchase_order_item_id?: string | null;
          product_id: string;
          ordered_quantity?: number;
          received_quantity?: number;
          rejected_quantity?: number;
          batch_id?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<GoodsReceiptItemsRow>;
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_goods_receipt_id_fkey";
            columns: ["goods_receipt_id"];
            isOneToOne: false;
            referencedRelation: "goods_receipts";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── purchase_invoices ─────────────────────────────────
      purchase_invoices: {
        Row: PurchaseInvoicesRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          invoice_number: string;
          supplier_invoice_number?: string | null;
          purchase_order_id?: string | null;
          supplier_id: string;
          invoice_date?: string;
          due_date?: string | null;
          status?: PurchaseInvoicesRow["status"];
          subtotal?: number;
          discount_amount?: number;
          tax_amount?: number;
          total_amount?: number;
          amount_paid?: number;
          notes?: string | null;
          posted_at?: string | null;
          posted_by?: string | null;
        };
        Update: Partial<PurchaseInvoicesRow>;
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── purchase_invoice_items ────────────────────────────
      purchase_invoice_items: {
        Row: PurchaseInvoiceItemsRow;
        Insert: {
          id?: string;
          organization_id: string;
          purchase_invoice_id: string;
          product_id: string;
          description?: string | null;
          quantity: number;
          unit_price?: number;
          tax_rate?: number;
          tax_amount?: number;
          line_total?: number;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<PurchaseInvoiceItemsRow>;
        Relationships: [
          {
            foreignKeyName: "purchase_invoice_items_purchase_invoice_id_fkey";
            columns: ["purchase_invoice_id"];
            isOneToOne: false;
            referencedRelation: "purchase_invoices";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── purchase_returns ──────────────────────────────────
      purchase_returns: {
        Row: PurchaseReturnsRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          return_number: string;
          purchase_order_id?: string | null;
          supplier_id: string;
          warehouse_id?: string | null;
          return_date?: string;
          reason?: PurchaseReturnsRow["reason"];
          status?: PurchaseReturnsRow["status"];
          subtotal?: number;
          tax_amount?: number;
          total_amount?: number;
          notes?: string | null;
        };
        Update: Partial<PurchaseReturnsRow>;
        Relationships: [
          {
            foreignKeyName: "purchase_returns_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── purchase_return_items ─────────────────────────────
      purchase_return_items: {
        Row: PurchaseReturnItemsRow;
        Insert: {
          id?: string;
          organization_id: string;
          purchase_return_id: string;
          product_id: string;
          quantity: number;
          unit_price?: number;
          tax_rate?: number;
          tax_amount?: number;
          line_total?: number;
          batch_id?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<PurchaseReturnItemsRow>;
        Relationships: [
          {
            foreignKeyName: "purchase_return_items_purchase_return_id_fkey";
            columns: ["purchase_return_id"];
            isOneToOne: false;
            referencedRelation: "purchase_returns";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── purchase_requests ─────────────────────────────────
      purchase_requests: {
        Row: PurchaseRequestsRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          request_number: string;
          status?: PurchaseRequestsRow["status"];
          warehouse_id?: string | null;
          required_date?: string | null;
          notes?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          rejected_reason?: string | null;
          converted_po_id?: string | null;
        };
        Update: Partial<PurchaseRequestsRow>;
        Relationships: [
          {
            foreignKeyName: "purchase_requests_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── purchase_request_items ────────────────────────────
      purchase_request_items: {
        Row: PurchaseRequestItemsRow;
        Insert: {
          id?: string;
          organization_id: string;
          purchase_request_id: string;
          product_id: string;
          description?: string | null;
          quantity: number;
          estimated_price?: number;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<PurchaseRequestItemsRow>;
        Relationships: [
          {
            foreignKeyName: "purchase_request_items_purchase_request_id_fkey";
            columns: ["purchase_request_id"];
            isOneToOne: false;
            referencedRelation: "purchase_requests";
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
      adjust_stock: {
        Args: {
          p_organization_id: string;
          p_product_id: string;
          p_warehouse_id: string;
          p_quantity: number;
          p_type: string;
          p_note?: string | null;
          p_reference_type?: string | null;
          p_reference_id?: string | null;
          p_batch_id?: string | null;
        };
        Returns: number;
      };
      transfer_stock: {
        Args: {
          p_organization_id: string;
          p_product_id: string;
          p_from_warehouse_id: string;
          p_to_warehouse_id: string;
          p_quantity: number;
          p_note?: string | null;
          p_batch_id?: string | null;
        };
        Returns: undefined;
      };
      receive_goods: {
        Args: {
          p_organization_id: string;
          p_purchase_order_id: string;
          p_warehouse_id: string;
          p_grn_number: string;
          p_received_date: string | null;
          p_notes: string | null;
          p_items: Json;
        };
        Returns: string;
      };
      post_purchase_invoice: {
        Args: { p_invoice_id: string };
        Returns: undefined;
      };
      complete_purchase_return: {
        Args: { p_return_id: string };
        Returns: undefined;
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
