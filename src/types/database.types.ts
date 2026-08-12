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
  // CBN: added by migration 20260628000001
  business_id: string | null;
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
  /** Accepted CBN connection representing this customer's organization. */
  cbn_connection_id: string | null;
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
  /** Accepted CBN connection representing this supplier's organization. */
  cbn_connection_id: string | null;
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

// ─── CBN Row types ────────────────────────────────────────────────────────────

type ConnectionStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "blocked"
  | "disconnected";

/** What the counterparty is to the requester; the recipient's role is inverse. */
type ConnectionPartyRole = "customer" | "supplier";

type CbnSyncStatus = "pending" | "accepted" | "rejected" | "cancelled";

type BusinessProfilesRow = AuditFields & {
  id: string;
  organization_id: string;
  verification_level: number;
  trust_score: number;
  is_discoverable: boolean;
  catalog_enabled: boolean;
  total_connections: number;
  total_invoices_sent: number;
  total_invoices_received: number;
  total_pos_sent: number;
  total_pos_received: number;
  payment_rating: number;
  delivery_rating: number;
  dispute_score: number;
  customer_rating: number;
};

type BusinessConnectionsRow = AuditFields & {
  id: string;
  organization_id: string;
  requester_organization_id: string;
  recipient_organization_id: string;
  status: ConnectionStatus;
  connection_message: string | null;
  requester_grants: string[];
  recipient_grants: string[];
  requested_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  disconnected_at: string | null;
  rejection_reason: string | null;
  requester_counterparty_role: ConnectionPartyRole | null;
};

type SupplierCatalogItemsRow = AuditFields & {
  id: string;
  organization_id: string;
  product_id: string;
  catalog_price: number;
  currency: string;
  moq: number;
  lead_time_days: number | null;
  stock_availability: "available" | "limited" | "out_of_stock" | "pre_order";
  is_published: boolean;
  catalog_notes: string | null;
};

type CbnInvoicesRow = AuditFields & {
  id: string;
  organization_id: string;
  counterparty_organization_id: string;
  connection_id: string;
  source_invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  status: CbnSyncStatus;
  accepted_at: string | null;
  accepted_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  buyer_purchase_invoice_id: string | null;
  buyer_purchase_order_id: string | null;
};

type CbnInvoiceItemsRow = AuditFields & {
  id: string;
  cbn_invoice_id: string;
  organization_id: string;
  sort_order: number;
  /** The SENDER's products.id — deliberately not a foreign key (other tenant). */
  supplier_product_id: string | null;
  product_name: string | null;
  product_sku: string | null;
  product_barcode: string | null;
  hsn_code: string | null;
  description: string | null;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  taxable_amount: number;
  gst_rate: number;
  tax_amount: number;
  line_total: number;
};

type CbnProductLinksRow = AuditFields & {
  id: string;
  organization_id: string;
  connection_id: string;
  /** The connected org's products.id — not a foreign key (other tenant). */
  counterparty_product_id: string;
  product_id: string;
};

type CbnPurchaseOrderItemsRow = AuditFields & {
  id: string;
  cbn_purchase_order_id: string;
  organization_id: string;
  sort_order: number;
  counterparty_product_id: string | null;
  product_name: string | null;
  product_sku: string | null;
  product_barcode: string | null;
  hsn_code: string | null;
  description: string | null;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  taxable_amount: number;
  gst_rate: number;
  tax_amount: number;
  line_total: number;
};

type CbnPurchaseOrdersRow = AuditFields & {
  id: string;
  organization_id: string;
  counterparty_organization_id: string;
  connection_id: string;
  source_purchase_order_id: string;
  po_number: string;
  po_date: string;
  expected_delivery_date: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  status: CbnSyncStatus | "fulfilled";
  accepted_at: string | null;
  accepted_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  supplier_sales_order_id: string | null;
};

type CbnSharedDocumentsRow = AuditFields & {
  id: string;
  organization_id: string;
  counterparty_organization_id: string;
  connection_id: string;
  document_type:
    | "purchase_order"
    | "quotation"
    | "sales_order"
    | "tax_invoice"
    | "delivery_challan"
    | "grn"
    | "credit_note"
    | "debit_note"
    | "payment_receipt"
    | "return_request"
    | "other";
  document_reference_type: string | null;
  document_reference_id: string | null;
  document_number: string | null;
  document_date: string | null;
  amount: number | null;
  currency: string;
  file_url: string | null;
  file_name: string | null;
  status: "active" | "revoked" | "superseded";
  notes: string | null;
};

type CbnEventsRow = {
  id: string;
  organization_id: string;
  connection_id: string | null;
  event_type: string;
  actor_user_id: string | null;
  source_organization_id: string | null;
  target_organization_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  correlation_id: string;
  metadata: Json;
  status: "success" | "failed" | "pending";
  error_message: string | null;
  created_at: string;
};

// ─── end CBN Row types ────────────────────────────────────────────────────────

// ─── AI Platform Row types ────────────────────────────────────────────────────

type AiInteractionsRow = {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  capability:
    | "assistant"
    | "ocr"
    | "forecast"
    | "recommendation"
    | "insight"
    | "search"
    | "report";
  model: string;
  prompt_summary: string | null;
  response_summary: string | null;
  confidence: number | null;
  input_tokens: number;
  output_tokens: number;
  execution_ms: number;
  approval_status: "not_required" | "pending" | "approved" | "rejected";
  status: "success" | "failed" | "refused";
  error_message: string | null;
  metadata: Json;
  created_at: string;
};

// ─── end AI Platform Row types ────────────────────────────────────────────────

// ─── Enterprise Row types ─────────────────────────────────────────────────────

type ApiKeysRow = {
  id: string;
  organization_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

type ApprovalRulesRow = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  entity_type: string;
  condition: Json;
  approver_role_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_by: string | null;
  version: number;
};

type ApprovalRequestsRow = {
  id: string;
  organization_id: string;
  rule_id: string | null;
  entity_type: string;
  entity_id: string;
  requested_by: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decided_by: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
  version: number;
};

type WebhookEndpointsRow = {
  id: string;
  organization_id: string;
  url: string;
  description: string | null;
  secret: string;
  event_types: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_by: string | null;
  version: number;
};

type WebhookDeliveriesRow = {
  id: string;
  organization_id: string;
  endpoint_id: string;
  event_type: string;
  payload: Json;
  status: "pending" | "success" | "failed";
  attempts: number;
  response_status: number | null;
  error: string | null;
  created_at: string;
  delivered_at: string | null;
};

type WorkflowsRow = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  trigger_event: string;
  definition: Json;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_by: string | null;
  version: number;
};

type WorkflowInstancesRow = {
  id: string;
  organization_id: string;
  workflow_id: string;
  entity_type: string | null;
  entity_id: string | null;
  status: "pending" | "running" | "awaiting" | "completed" | "failed" | "cancelled";
  current_step_index: number;
  context: Json;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
};

type WorkflowStepExecutionsRow = {
  id: string;
  organization_id: string;
  instance_id: string;
  step_id: string;
  step_index: number;
  step_type: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  output: Json;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type MarketplaceListingsRow = {
  id: string;
  organization_id: string;
  listing_type: "product" | "supplier";
  product_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  price: number | null;
  currency: string;
  unit: string | null;
  min_order_qty: number | null;
  is_published: boolean;
  status: "active" | "paused" | "archived";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_by: string | null;
  version: number;
};

type MarketplaceReviewsRow = {
  id: string;
  organization_id: string;
  subject_organization_id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  reference_type: string | null;
  reference_id: string | null;
  is_recommended: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_by: string | null;
  version: number;
};

type MarketplaceOrdersRow = {
  id: string;
  organization_id: string;
  seller_organization_id: string;
  listing_id: string | null;
  status: "pending" | "confirmed" | "cancelled" | "fulfilled" | "completed";
  quantity: number;
  total_amount: number;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  version: number;
};

type MarketplacePaymentsRow = {
  id: string;
  organization_id: string;
  counterparty_organization_id: string;
  order_id: string;
  provider: string;
  status: "pending" | "held" | "released" | "refunded" | "failed";
  amount: number;
  currency: string;
  external_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  version: number;
};

type MarketplaceShipmentsRow = {
  id: string;
  organization_id: string;
  counterparty_organization_id: string;
  order_id: string;
  provider: string;
  carrier: string | null;
  tracking_number: string | null;
  status: "pending" | "in_transit" | "delivered" | "cancelled";
  shipped_at: string | null;
  delivered_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  version: number;
};

// ─── end Enterprise Row types ─────────────────────────────────────────────────

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
  type: "inventory" | "service";
  status: "draft" | "active" | "discontinued" | "archived";
  category_id: string | null;
  brand_id: string | null;
  unit_id: string | null;
  manufacturer: string | null;
  hsn_code: string | null;
  gst_rate: number;
  gst_rates: number[];
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
  branch_id: string;
  quantity: number;
  reserved_quantity: number;
  created_at: string;
  updated_at: string;
};

type InventoryTransactionsRow = {
  id: string;
  organization_id: string;
  product_id: string;
  branch_id: string;
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
  branch_id: string | null;
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
  branch_id: string | null;
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
  branch_id: string;
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
  /**
   * STORED generated column (paid | partial | unpaid). Read-only — computed by
   * Postgres from amount_paid vs total_amount, never written by the app.
   */
  payment_status: string;
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
  branch_id: string | null;
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
  branch_id: string | null;
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

// ── Sales domain ─────────────────────────────────────────────

type QuotationStatus = "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired" | "converted";
type SalesOrderStatus = "draft" | "submitted" | "approved" | "processing" | "partially_delivered" | "completed" | "cancelled";
type InvoiceStatus = "draft" | "posted" | "cancelled";
type InvoiceType = "tax_invoice" | "retail_invoice" | "proforma_invoice" | "commercial_invoice" | "export_invoice";
type PaymentStatus = "unpaid" | "partial" | "paid" | "overdue";
type SalesReturnStatus = "draft" | "completed" | "cancelled";
type SalesReturnReason = "damaged" | "wrong_product" | "expired" | "customer_rejection" | "warranty" | "other";
type CreditNoteStatus = "active" | "applied" | "cancelled";

type QuotationsRow = AuditFields & {
  id: string;
  organization_id: string;
  quotation_number: string;
  customer_id: string;
  branch_id: string | null;
  salesperson_id: string | null;
  reference_number: string | null;
  quotation_date: string;
  expiry_date: string | null;
  supply_state: string | null;
  is_interstate: boolean;
  status: QuotationStatus;
  subtotal: number;
  discount_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  tax_amount: number;
  round_off: number;
  total_amount: number;
  notes: string | null;
  terms: string | null;
  converted_so_id: string | null;
  converted_inv_id: string | null;
};

type QuotationItemsRow = {
  id: string;
  organization_id: string;
  quotation_id: string;
  product_id: string;
  description: string | null;
  hsn_code: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  taxable_amount: number;
  gst_rate: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  tax_amount: number;
  line_total: number;
  sort_order: number;
  created_at: string;
  created_by: string | null;
};

type SalesOrdersRow = AuditFields & {
  id: string;
  organization_id: string;
  so_number: string;
  customer_id: string;
  quotation_id: string | null;
  branch_id: string | null;
  salesperson_id: string | null;
  reference_number: string | null;
  order_date: string;
  delivery_date: string | null;
  payment_terms_days: number;
  supply_state: string | null;
  is_interstate: boolean;
  status: SalesOrderStatus;
  subtotal: number;
  discount_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  tax_amount: number;
  round_off: number;
  total_amount: number;
  notes: string | null;
  terms: string | null;
  approved_by: string | null;
  approved_at: string | null;
  converted_inv_id: string | null;
};

type SalesOrderItemsRow = {
  id: string;
  organization_id: string;
  sales_order_id: string;
  product_id: string;
  description: string | null;
  hsn_code: string | null;
  quantity: number;
  delivered_qty: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  taxable_amount: number;
  gst_rate: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  tax_amount: number;
  line_total: number;
  sort_order: number;
  created_at: string;
  created_by: string | null;
};

type InvoicesRow = AuditFields & {
  id: string;
  organization_id: string;
  invoice_number: string;
  invoice_type: InvoiceType;
  customer_id: string;
  sales_order_id: string | null;
  quotation_id: string | null;
  branch_id: string | null;
  salesperson_id: string | null;
  reference_number: string | null;
  invoice_date: string;
  due_date: string | null;
  payment_terms_days: number;
  supply_state: string | null;
  is_interstate: boolean;
  subtotal: number;
  discount_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  tax_amount: number;
  round_off: number;
  total_amount: number;
  amount_paid: number;
  payment_status: PaymentStatus;
  status: InvoiceStatus;
  notes: string | null;
  terms: string | null;
  posted_at: string | null;
  posted_by: string | null;
};

type InvoiceItemsRow = {
  id: string;
  organization_id: string;
  invoice_id: string;
  product_id: string;
  description: string | null;
  hsn_code: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  taxable_amount: number;
  gst_rate: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  tax_amount: number;
  line_total: number;
  sort_order: number;
  created_at: string;
  created_by: string | null;
};

type SalesReturnsRow = AuditFields & {
  id: string;
  organization_id: string;
  return_number: string;
  invoice_id: string | null;
  customer_id: string;
  branch_id: string | null;
  return_date: string;
  reason: SalesReturnReason;
  status: SalesReturnStatus;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
};

type SalesReturnItemsRow = {
  id: string;
  organization_id: string;
  sales_return_id: string;
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

type CreditNotesRow = AuditFields & {
  id: string;
  organization_id: string;
  credit_note_number: string;
  customer_id: string;
  invoice_id: string | null;
  sales_return_id: string | null;
  issue_date: string;
  reason: string | null;
  amount: number;
  status: CreditNoteStatus;
  notes: string | null;
};

// ── Payment domain ────────────────────────────────────────────

type PaymentMethod =
  | "cash"
  | "upi"
  | "bank_transfer"
  | "cheque"
  | "credit_card"
  | "debit_card"
  | "wallet"
  | "other";

type CustomerPaymentsRow = AuditFields & {
  id: string;
  organization_id: string;
  payment_number: string;
  customer_id: string;
  payment_date: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_number: string | null;
  notes: string | null;
  status: "completed" | "voided";
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
};

type CustomerPaymentAllocationsRow = {
  id: string;
  organization_id: string;
  customer_payment_id: string;
  invoice_id: string;
  allocated_amount: number;
  created_at: string;
  created_by: string | null;
};

type SupplierPaymentsRow = AuditFields & {
  id: string;
  organization_id: string;
  payment_number: string;
  supplier_id: string;
  payment_date: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_number: string | null;
  notes: string | null;
  status: "completed" | "voided";
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
};

type SupplierPaymentAllocationsRow = {
  id: string;
  organization_id: string;
  supplier_payment_id: string;
  purchase_invoice_id: string;
  allocated_amount: number;
  created_at: string;
  created_by: string | null;
};

// ─────────────────────────────────────────────────────────────

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
          gst_rates?: number[];
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
          branch_id: string;
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
            foreignKeyName: "inventory_branch_id_fkey";
            columns: ["branch_id"];
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
          branch_id: string;
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
          branch_id?: string | null;
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
          branch_id?: string | null;
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
          branch_id: string;
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
          branch_id?: string | null;
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
          branch_id?: string | null;
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

      // ── quotations ────────────────────────────────────────
      quotations: {
        Row: QuotationsRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          quotation_number: string;
          customer_id: string;
          branch_id?: string | null;
          salesperson_id?: string | null;
          reference_number?: string | null;
          quotation_date?: string;
          expiry_date?: string | null;
          supply_state?: string | null;
          is_interstate?: boolean;
          status?: QuotationStatus;
          subtotal?: number;
          discount_amount?: number;
          cgst_amount?: number;
          sgst_amount?: number;
          igst_amount?: number;
          tax_amount?: number;
          round_off?: number;
          total_amount?: number;
          notes?: string | null;
          terms?: string | null;
          converted_so_id?: string | null;
          converted_inv_id?: string | null;
        };
        Update: Partial<QuotationsRow>;
        Relationships: [
          {
            foreignKeyName: "quotations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── quotation_items ───────────────────────────────────
      quotation_items: {
        Row: QuotationItemsRow;
        Insert: {
          id?: string;
          organization_id: string;
          quotation_id: string;
          product_id: string;
          description?: string | null;
          hsn_code?: string | null;
          quantity: number;
          unit_price?: number;
          discount_percent?: number;
          discount_amount?: number;
          taxable_amount?: number;
          gst_rate?: number;
          cgst_rate?: number;
          sgst_rate?: number;
          igst_rate?: number;
          cgst_amount?: number;
          sgst_amount?: number;
          igst_amount?: number;
          tax_amount?: number;
          line_total?: number;
          sort_order?: number;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<QuotationItemsRow>;
        Relationships: [
          {
            foreignKeyName: "quotation_items_quotation_id_fkey";
            columns: ["quotation_id"];
            isOneToOne: false;
            referencedRelation: "quotations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── sales_orders ──────────────────────────────────────
      sales_orders: {
        Row: SalesOrdersRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          so_number: string;
          customer_id: string;
          quotation_id?: string | null;
          branch_id?: string | null;
          salesperson_id?: string | null;
          reference_number?: string | null;
          order_date?: string;
          delivery_date?: string | null;
          payment_terms_days?: number;
          supply_state?: string | null;
          is_interstate?: boolean;
          status?: SalesOrderStatus;
          subtotal?: number;
          discount_amount?: number;
          cgst_amount?: number;
          sgst_amount?: number;
          igst_amount?: number;
          tax_amount?: number;
          round_off?: number;
          total_amount?: number;
          notes?: string | null;
          terms?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          converted_inv_id?: string | null;
        };
        Update: Partial<SalesOrdersRow>;
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── sales_order_items ─────────────────────────────────
      sales_order_items: {
        Row: SalesOrderItemsRow;
        Insert: {
          id?: string;
          organization_id: string;
          sales_order_id: string;
          product_id: string;
          description?: string | null;
          hsn_code?: string | null;
          quantity: number;
          delivered_qty?: number;
          unit_price?: number;
          discount_percent?: number;
          discount_amount?: number;
          taxable_amount?: number;
          gst_rate?: number;
          cgst_rate?: number;
          sgst_rate?: number;
          igst_rate?: number;
          cgst_amount?: number;
          sgst_amount?: number;
          igst_amount?: number;
          tax_amount?: number;
          line_total?: number;
          sort_order?: number;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<SalesOrderItemsRow>;
        Relationships: [
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey";
            columns: ["sales_order_id"];
            isOneToOne: false;
            referencedRelation: "sales_orders";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── invoices ──────────────────────────────────────────
      invoices: {
        Row: InvoicesRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          invoice_number: string;
          invoice_type?: InvoiceType;
          customer_id: string;
          sales_order_id?: string | null;
          quotation_id?: string | null;
          branch_id?: string | null;
          salesperson_id?: string | null;
          reference_number?: string | null;
          invoice_date?: string;
          due_date?: string | null;
          payment_terms_days?: number;
          supply_state?: string | null;
          is_interstate?: boolean;
          subtotal?: number;
          discount_amount?: number;
          cgst_amount?: number;
          sgst_amount?: number;
          igst_amount?: number;
          tax_amount?: number;
          round_off?: number;
          total_amount?: number;
          amount_paid?: number;
          payment_status?: PaymentStatus;
          status?: InvoiceStatus;
          notes?: string | null;
          terms?: string | null;
          posted_at?: string | null;
          posted_by?: string | null;
        };
        Update: Partial<InvoicesRow>;
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── invoice_items ─────────────────────────────────────
      invoice_items: {
        Row: InvoiceItemsRow;
        Insert: {
          id?: string;
          organization_id: string;
          invoice_id: string;
          product_id: string;
          description?: string | null;
          hsn_code?: string | null;
          quantity: number;
          unit_price?: number;
          discount_percent?: number;
          discount_amount?: number;
          taxable_amount?: number;
          gst_rate?: number;
          cgst_rate?: number;
          sgst_rate?: number;
          igst_rate?: number;
          cgst_amount?: number;
          sgst_amount?: number;
          igst_amount?: number;
          tax_amount?: number;
          line_total?: number;
          sort_order?: number;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<InvoiceItemsRow>;
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── sales_returns ─────────────────────────────────────
      sales_returns: {
        Row: SalesReturnsRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          return_number: string;
          invoice_id?: string | null;
          customer_id: string;
          branch_id?: string | null;
          return_date?: string;
          reason?: SalesReturnReason;
          status?: SalesReturnStatus;
          subtotal?: number;
          tax_amount?: number;
          total_amount?: number;
          notes?: string | null;
        };
        Update: Partial<SalesReturnsRow>;
        Relationships: [
          {
            foreignKeyName: "sales_returns_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── sales_return_items ────────────────────────────────
      sales_return_items: {
        Row: SalesReturnItemsRow;
        Insert: {
          id?: string;
          organization_id: string;
          sales_return_id: string;
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
        Update: Partial<SalesReturnItemsRow>;
        Relationships: [
          {
            foreignKeyName: "sales_return_items_sales_return_id_fkey";
            columns: ["sales_return_id"];
            isOneToOne: false;
            referencedRelation: "sales_returns";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── credit_notes ──────────────────────────────────────
      credit_notes: {
        Row: CreditNotesRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          credit_note_number: string;
          customer_id: string;
          invoice_id?: string | null;
          sales_return_id?: string | null;
          issue_date?: string;
          reason?: string | null;
          amount: number;
          status?: CreditNoteStatus;
          notes?: string | null;
        };
        Update: Partial<CreditNotesRow>;
        Relationships: [
          {
            foreignKeyName: "credit_notes_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
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

      // ── customer_payments ─────────────────────────────────
      customer_payments: {
        Row: CustomerPaymentsRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          payment_number: string;
          customer_id: string;
          payment_date?: string;
          amount: number;
          payment_method?: PaymentMethod;
          reference_number?: string | null;
          notes?: string | null;
          status?: CustomerPaymentsRow["status"];
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
        };
        Update: Partial<CustomerPaymentsRow>;
        Relationships: [
          {
            foreignKeyName: "customer_payments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── customer_payment_allocations ──────────────────────
      customer_payment_allocations: {
        Row: CustomerPaymentAllocationsRow;
        Insert: {
          id?: string;
          organization_id: string;
          customer_payment_id: string;
          invoice_id: string;
          allocated_amount: number;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<CustomerPaymentAllocationsRow>;
        Relationships: [
          {
            foreignKeyName: "customer_payment_allocations_customer_payment_id_fkey";
            columns: ["customer_payment_id"];
            isOneToOne: false;
            referencedRelation: "customer_payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_payment_allocations_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── supplier_payments ─────────────────────────────────
      supplier_payments: {
        Row: SupplierPaymentsRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          payment_number: string;
          supplier_id: string;
          payment_date?: string;
          amount: number;
          payment_method?: PaymentMethod;
          reference_number?: string | null;
          notes?: string | null;
          status?: SupplierPaymentsRow["status"];
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
        };
        Update: Partial<SupplierPaymentsRow>;
        Relationships: [
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── supplier_payment_allocations ──────────────────────
      supplier_payment_allocations: {
        Row: SupplierPaymentAllocationsRow;
        Insert: {
          id?: string;
          organization_id: string;
          supplier_payment_id: string;
          purchase_invoice_id: string;
          allocated_amount: number;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<SupplierPaymentAllocationsRow>;
        Relationships: [
          {
            foreignKeyName: "supplier_payment_allocations_supplier_payment_id_fkey";
            columns: ["supplier_payment_id"];
            isOneToOne: false;
            referencedRelation: "supplier_payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_payment_allocations_purchase_invoice_id_fkey";
            columns: ["purchase_invoice_id"];
            isOneToOne: false;
            referencedRelation: "purchase_invoices";
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

      // ── business_profiles ─────────────────────────────────
      business_profiles: {
        Row: BusinessProfilesRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          verification_level?: number;
          trust_score?: number;
          is_discoverable?: boolean;
          catalog_enabled?: boolean;
          total_connections?: number;
          total_invoices_sent?: number;
          total_invoices_received?: number;
          total_pos_sent?: number;
          total_pos_received?: number;
          payment_rating?: number;
          delivery_rating?: number;
          dispute_score?: number;
          customer_rating?: number;
        };
        Update: Partial<BusinessProfilesRow>;
        Relationships: [
          {
            foreignKeyName: "business_profiles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── business_connections ──────────────────────────────
      business_connections: {
        Row: BusinessConnectionsRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          requester_organization_id: string;
          recipient_organization_id: string;
          status?: ConnectionStatus;
          connection_message?: string | null;
          requester_grants?: string[];
          recipient_grants?: string[];
          requested_at?: string;
          accepted_at?: string | null;
          rejected_at?: string | null;
          disconnected_at?: string | null;
          rejection_reason?: string | null;
          requester_counterparty_role?: ConnectionPartyRole | null;
        };
        Update: Partial<BusinessConnectionsRow>;
        Relationships: [
          {
            foreignKeyName: "business_connections_requester_organization_id_fkey";
            columns: ["requester_organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_connections_recipient_organization_id_fkey";
            columns: ["recipient_organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── supplier_catalog_items ────────────────────────────
      supplier_catalog_items: {
        Row: SupplierCatalogItemsRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          product_id: string;
          catalog_price?: number;
          currency?: string;
          moq?: number;
          lead_time_days?: number | null;
          stock_availability?: SupplierCatalogItemsRow["stock_availability"];
          is_published?: boolean;
          catalog_notes?: string | null;
        };
        Update: Partial<SupplierCatalogItemsRow>;
        Relationships: [
          {
            foreignKeyName: "supplier_catalog_items_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_catalog_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── cbn_invoices ──────────────────────────────────────
      cbn_invoices: {
        Row: CbnInvoicesRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          counterparty_organization_id: string;
          connection_id: string;
          source_invoice_id: string;
          invoice_number: string;
          invoice_date: string;
          due_date?: string | null;
          subtotal?: number;
          tax_amount?: number;
          total_amount?: number;
          currency?: string;
          status?: CbnSyncStatus;
          accepted_at?: string | null;
          accepted_by?: string | null;
          rejected_at?: string | null;
          rejected_by?: string | null;
          rejection_reason?: string | null;
          buyer_purchase_invoice_id?: string | null;
          buyer_purchase_order_id?: string | null;
        };
        Update: Partial<CbnInvoicesRow>;
        Relationships: [
          {
            foreignKeyName: "cbn_invoices_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "business_connections";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── cbn_invoice_items ─────────────────────────────────
      cbn_invoice_items: {
        Row: CbnInvoiceItemsRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          cbn_invoice_id: string;
          organization_id: string;
          sort_order?: number;
          supplier_product_id?: string | null;
          product_name?: string | null;
          product_sku?: string | null;
          product_barcode?: string | null;
          hsn_code?: string | null;
          description?: string | null;
          quantity: number;
          unit_price?: number;
          discount_amount?: number;
          taxable_amount?: number;
          gst_rate?: number;
          tax_amount?: number;
          line_total?: number;
        };
        Update: Partial<CbnInvoiceItemsRow>;
        Relationships: [
          {
            foreignKeyName: "cbn_invoice_items_cbn_invoice_id_fkey";
            columns: ["cbn_invoice_id"];
            isOneToOne: false;
            referencedRelation: "cbn_invoices";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── cbn_purchase_order_items ──────────────────────────
      cbn_purchase_order_items: {
        Row: CbnPurchaseOrderItemsRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          cbn_purchase_order_id: string;
          organization_id: string;
          sort_order?: number;
          counterparty_product_id?: string | null;
          product_name?: string | null;
          product_sku?: string | null;
          product_barcode?: string | null;
          hsn_code?: string | null;
          description?: string | null;
          quantity: number;
          unit_price?: number;
          discount_amount?: number;
          taxable_amount?: number;
          gst_rate?: number;
          tax_amount?: number;
          line_total?: number;
        };
        Update: Partial<CbnPurchaseOrderItemsRow>;
        Relationships: [
          {
            foreignKeyName: "cbn_purchase_order_items_cbn_purchase_order_id_fkey";
            columns: ["cbn_purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "cbn_purchase_orders";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── cbn_product_links ─────────────────────────────────
      cbn_product_links: {
        Row: CbnProductLinksRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          connection_id: string;
          counterparty_product_id: string;
          product_id: string;
        };
        Update: Partial<CbnProductLinksRow>;
        Relationships: [
          {
            foreignKeyName: "cbn_product_links_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── cbn_purchase_orders ───────────────────────────────
      cbn_purchase_orders: {
        Row: CbnPurchaseOrdersRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          counterparty_organization_id: string;
          connection_id: string;
          source_purchase_order_id: string;
          po_number: string;
          po_date: string;
          expected_delivery_date?: string | null;
          subtotal?: number;
          tax_amount?: number;
          total_amount?: number;
          currency?: string;
          status?: CbnPurchaseOrdersRow["status"];
          accepted_at?: string | null;
          accepted_by?: string | null;
          rejected_at?: string | null;
          rejected_by?: string | null;
          rejection_reason?: string | null;
          supplier_sales_order_id?: string | null;
        };
        Update: Partial<CbnPurchaseOrdersRow>;
        Relationships: [
          {
            foreignKeyName: "cbn_purchase_orders_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "business_connections";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── cbn_shared_documents ──────────────────────────────
      cbn_shared_documents: {
        Row: CbnSharedDocumentsRow;
        Insert: Partial<AuditFields> & {
          id?: string;
          organization_id: string;
          counterparty_organization_id: string;
          connection_id: string;
          document_type: CbnSharedDocumentsRow["document_type"];
          document_reference_type?: string | null;
          document_reference_id?: string | null;
          document_number?: string | null;
          document_date?: string | null;
          amount?: number | null;
          currency?: string;
          file_url?: string | null;
          file_name?: string | null;
          status?: CbnSharedDocumentsRow["status"];
          notes?: string | null;
        };
        Update: Partial<CbnSharedDocumentsRow>;
        Relationships: [
          {
            foreignKeyName: "cbn_shared_documents_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "business_connections";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── cbn_events ────────────────────────────────────────
      cbn_events: {
        Row: CbnEventsRow;
        Insert: {
          id?: string;
          organization_id: string;
          connection_id?: string | null;
          event_type: string;
          actor_user_id?: string | null;
          source_organization_id?: string | null;
          target_organization_id?: string | null;
          reference_type?: string | null;
          reference_id?: string | null;
          correlation_id?: string;
          metadata?: Json;
          status?: CbnEventsRow["status"];
          error_message?: string | null;
          created_at?: string;
        };
        Update: Partial<CbnEventsRow>;
        Relationships: [
          {
            foreignKeyName: "cbn_events_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── api_keys ──────────────────────────────────────────
      api_keys: {
        Row: ApiKeysRow;
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          scopes?: string[];
          last_used_at?: string | null;
          expires_at?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: Partial<ApiKeysRow>;
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── approval_rules ────────────────────────────────────
      approval_rules: {
        Row: ApprovalRulesRow;
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          entity_type: string;
          condition?: Json;
          approver_role_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          deleted_by?: string | null;
          version?: number;
        };
        Update: Partial<ApprovalRulesRow>;
        Relationships: [
          {
            foreignKeyName: "approval_rules_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── approval_requests ─────────────────────────────────
      approval_requests: {
        Row: ApprovalRequestsRow;
        Insert: {
          id?: string;
          organization_id: string;
          rule_id?: string | null;
          entity_type: string;
          entity_id: string;
          requested_by?: string | null;
          status?: ApprovalRequestsRow["status"];
          decided_by?: string | null;
          decided_at?: string | null;
          decision_reason?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<ApprovalRequestsRow>;
        Relationships: [
          {
            foreignKeyName: "approval_requests_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── webhook_endpoints ─────────────────────────────────
      webhook_endpoints: {
        Row: WebhookEndpointsRow;
        Insert: {
          id?: string;
          organization_id: string;
          url: string;
          description?: string | null;
          secret: string;
          event_types?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          deleted_by?: string | null;
          version?: number;
        };
        Update: Partial<WebhookEndpointsRow>;
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── webhook_deliveries ────────────────────────────────
      webhook_deliveries: {
        Row: WebhookDeliveriesRow;
        Insert: {
          id?: string;
          organization_id: string;
          endpoint_id: string;
          event_type: string;
          payload?: Json;
          status?: WebhookDeliveriesRow["status"];
          attempts?: number;
          response_status?: number | null;
          error?: string | null;
          created_at?: string;
          delivered_at?: string | null;
        };
        Update: Partial<WebhookDeliveriesRow>;
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey";
            columns: ["endpoint_id"];
            isOneToOne: false;
            referencedRelation: "webhook_endpoints";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── workflows ─────────────────────────────────────────
      workflows: {
        Row: WorkflowsRow;
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          trigger_event: string;
          definition?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          deleted_by?: string | null;
          version?: number;
        };
        Update: Partial<WorkflowsRow>;
        Relationships: [
          {
            foreignKeyName: "workflows_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── workflow_instances ────────────────────────────────
      workflow_instances: {
        Row: WorkflowInstancesRow;
        Insert: {
          id?: string;
          organization_id: string;
          workflow_id: string;
          entity_type?: string | null;
          entity_id?: string | null;
          status?: WorkflowInstancesRow["status"];
          current_step_index?: number;
          context?: Json;
          error?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<WorkflowInstancesRow>;
        Relationships: [
          {
            foreignKeyName: "workflow_instances_workflow_id_fkey";
            columns: ["workflow_id"];
            isOneToOne: false;
            referencedRelation: "workflows";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── workflow_step_executions ──────────────────────────
      workflow_step_executions: {
        Row: WorkflowStepExecutionsRow;
        Insert: {
          id?: string;
          organization_id: string;
          instance_id: string;
          step_id: string;
          step_index: number;
          step_type: string;
          status?: WorkflowStepExecutionsRow["status"];
          output?: Json;
          error?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<WorkflowStepExecutionsRow>;
        Relationships: [
          {
            foreignKeyName: "workflow_step_executions_instance_id_fkey";
            columns: ["instance_id"];
            isOneToOne: false;
            referencedRelation: "workflow_instances";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── marketplace_listings ──────────────────────────────
      marketplace_listings: {
        Row: MarketplaceListingsRow;
        Insert: {
          id?: string;
          organization_id: string;
          listing_type: MarketplaceListingsRow["listing_type"];
          product_id?: string | null;
          title: string;
          description?: string | null;
          category?: string | null;
          price?: number | null;
          currency?: string;
          unit?: string | null;
          min_order_qty?: number | null;
          is_published?: boolean;
          status?: MarketplaceListingsRow["status"];
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          deleted_by?: string | null;
          version?: number;
        };
        Update: Partial<MarketplaceListingsRow>;
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── marketplace_reviews ───────────────────────────────
      marketplace_reviews: {
        Row: MarketplaceReviewsRow;
        Insert: {
          id?: string;
          organization_id: string;
          subject_organization_id: string;
          rating: number;
          title?: string | null;
          comment?: string | null;
          reference_type?: string | null;
          reference_id?: string | null;
          is_recommended?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          deleted_by?: string | null;
          version?: number;
        };
        Update: Partial<MarketplaceReviewsRow>;
        Relationships: [
          {
            foreignKeyName: "marketplace_reviews_subject_organization_id_fkey";
            columns: ["subject_organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── marketplace_orders ────────────────────────────────
      marketplace_orders: {
        Row: MarketplaceOrdersRow;
        Insert: {
          id?: string;
          organization_id: string;
          seller_organization_id: string;
          listing_id?: string | null;
          status?: MarketplaceOrdersRow["status"];
          quantity?: number;
          total_amount?: number;
          currency?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
          version?: number;
        };
        Update: Partial<MarketplaceOrdersRow>;
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── marketplace_payments ──────────────────────────────
      marketplace_payments: {
        Row: MarketplacePaymentsRow;
        Insert: {
          id?: string;
          organization_id: string;
          counterparty_organization_id: string;
          order_id: string;
          provider?: string;
          status?: MarketplacePaymentsRow["status"];
          amount?: number;
          currency?: string;
          external_reference?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
          version?: number;
        };
        Update: Partial<MarketplacePaymentsRow>;
        Relationships: [
          {
            foreignKeyName: "marketplace_payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_orders";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── marketplace_shipments ─────────────────────────────
      marketplace_shipments: {
        Row: MarketplaceShipmentsRow;
        Insert: {
          id?: string;
          organization_id: string;
          counterparty_organization_id: string;
          order_id: string;
          provider?: string;
          carrier?: string | null;
          tracking_number?: string | null;
          status?: MarketplaceShipmentsRow["status"];
          shipped_at?: string | null;
          delivered_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
          version?: number;
        };
        Update: Partial<MarketplaceShipmentsRow>;
        Relationships: [
          {
            foreignKeyName: "marketplace_shipments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_orders";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── ai_interactions ───────────────────────────────────
      ai_interactions: {
        Row: AiInteractionsRow;
        Insert: {
          id?: string;
          organization_id: string;
          actor_user_id?: string | null;
          capability: AiInteractionsRow["capability"];
          model: string;
          prompt_summary?: string | null;
          response_summary?: string | null;
          confidence?: number | null;
          input_tokens?: number;
          output_tokens?: number;
          execution_ms?: number;
          approval_status?: AiInteractionsRow["approval_status"];
          status?: AiInteractionsRow["status"];
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<AiInteractionsRow>;
        Relationships: [
          {
            foreignKeyName: "ai_interactions_organization_id_fkey";
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
          p_branch_id: string;
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
          p_from_branch_id: string;
          p_to_branch_id: string;
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
          p_branch_id: string;
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
      post_sales_invoice: {
        Args: { p_invoice_id: string };
        Returns: undefined;
      };
      complete_sales_return: {
        Args: { p_return_id: string };
        Returns: undefined;
      };
      record_customer_payment: {
        Args: {
          p_org_id: string;
          p_customer_id: string;
          p_amount: number;
          p_method: string | null;
          p_reference: string | null;
          p_payment_date: string | null;
          p_notes: string | null;
          p_payment_number: string;
          p_allocations: Json;
        };
        Returns: string;
      };
      record_supplier_payment: {
        Args: {
          p_org_id: string;
          p_supplier_id: string;
          p_amount: number;
          p_method: string | null;
          p_reference: string | null;
          p_payment_date: string | null;
          p_notes: string | null;
          p_payment_number: string;
          p_allocations: Json;
        };
        Returns: string;
      };
      apply_customer_credit: {
        Args: {
          p_org_id: string;
          p_customer_id: string;
          p_invoice_id: string;
          p_amount: number;
        };
        Returns: undefined;
      };
      apply_supplier_credit: {
        Args: {
          p_org_id: string;
          p_supplier_id: string;
          p_bill_id: string;
          p_amount: number;
        };
        Returns: undefined;
      };
      // ── CBN Helper Functions ───────────────────────────────
      get_connected_organization_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
      search_businesses: {
        Args: { p_query: string; p_limit?: number; p_offset?: number };
        Returns: {
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
        }[];
      };
      get_business_public_profile: {
        Args: { p_organization_id: string };
        Returns: {
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
          website: string | null;
          email: string | null;
          phone: string | null;
          verification_status: string;
          verification_level: number;
          trust_score: number;
          catalog_enabled: boolean;
          total_connections: number;
          is_connected: boolean;
          connection_id: string | null;
          connection_status: string | null;
        }[];
      };
      search_supplier_catalog: {
        Args: {
          p_supplier_org_id: string;
          p_query?: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          product_id: string;
          product_name: string;
          product_sku: string | null;
          catalog_price: number;
          currency: string;
          moq: number;
          lead_time_days: number | null;
          stock_availability: string;
          catalog_notes: string | null;
        }[];
      };
      // ── CBN Connection RPCs ────────────────────────────────
      request_business_connection: {
        Args: {
          p_requester_org_id: string;
          p_recipient_org_id: string;
          p_message?: string | null;
        };
        Returns: string;
      };
      accept_connection_request: {
        Args: { p_connection_id: string };
        Returns: undefined;
      };
      reject_connection_request: {
        Args: { p_connection_id: string; p_reason?: string | null };
        Returns: undefined;
      };
      disconnect_business: {
        Args: { p_connection_id: string; p_reason?: string | null };
        Returns: undefined;
      };
      update_connection_permissions: {
        Args: { p_connection_id: string; p_my_grants: string[] };
        Returns: undefined;
      };
      // ── CBN Invoice Sync RPCs ──────────────────────────────
      send_cbn_invoice: {
        Args: { p_invoice_id: string; p_connection_id: string };
        Returns: string;
      };
      accept_cbn_invoice: {
        Args: {
          p_cbn_invoice_id: string;
          p_buyer_org_id: string;
          p_notes?: string | null;
          /** [{ cbn_invoice_item_id, product_id }] — one entry per line. */
          p_line_mappings?: Json;
        };
        Returns: string;
      };
      reject_cbn_invoice: {
        Args: {
          p_cbn_invoice_id: string;
          p_buyer_org_id: string;
          p_reason: string;
        };
        Returns: undefined;
      };
      // ── CBN Purchase Sync RPCs ─────────────────────────────
      send_cbn_purchase_order: {
        Args: { p_po_id: string; p_connection_id: string };
        Returns: string;
      };
      accept_cbn_purchase_order: {
        Args: {
          p_cbn_po_id: string;
          p_supplier_org_id: string;
          p_notes?: string | null;
          /** [{ line_id, product_id }] — one entry per line. */
          p_line_mappings?: Json;
        };
        Returns: string;
      };
      reject_cbn_purchase_order: {
        Args: {
          p_cbn_po_id: string;
          p_supplier_org_id: string;
          p_reason: string;
        };
        Returns: undefined;
      };
      // ── CBN Trust Score RPC ────────────────────────────────
      compute_trust_score: {
        Args: { p_org_id: string };
        Returns: number;
      };
      // ── Marketplace functions ──────────────────────────────
      search_marketplace_listings: {
        Args: {
          p_query?: string;
          p_listing_type?: string;
          p_category?: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          organization_id: string;
          seller_name: string;
          listing_type: string;
          product_id: string | null;
          title: string;
          description: string | null;
          category: string | null;
          price: number | null;
          currency: string;
          unit: string | null;
          min_order_qty: number | null;
          created_at: string;
        }[];
      };
      get_organization_reputation: {
        Args: { p_org_id: string };
        Returns: {
          review_count: number;
          average_rating: number;
          recommended_count: number;
          recommend_percent: number;
        }[];
      };
      list_organization_reviews: {
        Args: { p_org_id: string; p_limit?: number; p_offset?: number };
        Returns: {
          id: string;
          reviewer_name: string;
          rating: number;
          title: string | null;
          comment: string | null;
          is_recommended: boolean;
          created_at: string;
        }[];
      };
      get_marketplace_listing: {
        Args: { p_id: string };
        Returns: {
          id: string;
          organization_id: string;
          title: string;
          listing_type: string;
          price: number | null;
          currency: string;
          min_order_qty: number | null;
          is_published: boolean;
          status: string;
        }[];
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
