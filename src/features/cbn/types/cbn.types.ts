/**
 * CBN (Connected Business Network) domain types.
 * All fields are camelCase; DB row fields (snake_case) are mapped in repositories.
 */

import type { Json } from "@/types/database.types";

// ─────────────────────────────────────────────────────────────
// Enums / literal unions
// ─────────────────────────────────────────────────────────────

export type ConnectionStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "blocked"
  | "disconnected";

export type CbnSyncStatus = "pending" | "accepted" | "rejected" | "cancelled";

export type CbnPoSyncStatus = CbnSyncStatus | "fulfilled";

export type ConnectionPermission =
  | "receive_invoices"
  | "receive_purchase_orders"
  | "receive_quotations"
  | "view_catalog"
  | "view_stock"
  | "receive_payments"
  | "share_documents"
  | "receive_delivery_updates"
  | "view_pricing";

export type SharedDocumentType =
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

export type SharedDocumentStatus = "active" | "revoked" | "superseded";

export type SupplierCatalogStockAvailability =
  | "available"
  | "limited"
  | "out_of_stock"
  | "pre_order";

export type CbnEventStatus = "success" | "failed" | "pending";

// ─────────────────────────────────────────────────────────────
// Error types
// ─────────────────────────────────────────────────────────────

export type CbnErrorCode =
  | "not_found"
  | "permission_denied"
  | "invalid_status"
  | "duplicate"
  | "prerequisite"
  | "validation"
  | "unknown";

export interface CbnError {
  readonly code: CbnErrorCode;
  readonly message: string;
}

export type CbnActionResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: CbnError };

// ─────────────────────────────────────────────────────────────
// Domain entities
// ─────────────────────────────────────────────────────────────

export interface BusinessProfile {
  readonly id: string;
  readonly organizationId: string;
  readonly verificationLevel: number;
  readonly trustScore: number;
  readonly isDiscoverable: boolean;
  readonly catalogEnabled: boolean;
  readonly totalConnections: number;
  readonly totalInvoicesSent: number;
  readonly totalInvoicesReceived: number;
  readonly totalPosSent: number;
  readonly totalPosReceived: number;
  readonly paymentRating: number;
  readonly deliveryRating: number;
  readonly disputeScore: number;
  readonly customerRating: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

export interface BusinessConnection {
  readonly id: string;
  readonly organizationId: string;
  readonly requesterOrganizationId: string;
  readonly recipientOrganizationId: string;
  readonly status: ConnectionStatus;
  readonly connectionMessage: string | null;
  readonly requesterGrants: string[];
  readonly recipientGrants: string[];
  readonly requestedAt: Date;
  readonly acceptedAt: Date | null;
  readonly rejectedAt: Date | null;
  readonly disconnectedAt: Date | null;
  readonly rejectionReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

/** Public-facing profile from the get_business_public_profile RPC */
export interface BusinessPublicProfile {
  readonly id: string;
  readonly name: string;
  readonly displayName: string | null;
  readonly businessId: string | null;
  readonly gstNumber: string | null;
  readonly businessType: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly country: string;
  readonly logoUrl: string | null;
  readonly website: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly verificationStatus: string;
  readonly verificationLevel: number;
  readonly trustScore: number;
  readonly catalogEnabled: boolean;
  readonly totalConnections: number;
  readonly isConnected: boolean;
  readonly connectionId: string | null;
  readonly connectionStatus: string | null;
}

/** Search result from the search_businesses RPC */
export interface BusinessSearchResult {
  readonly id: string;
  readonly name: string;
  readonly displayName: string | null;
  readonly businessId: string | null;
  readonly gstNumber: string | null;
  readonly businessType: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly country: string;
  readonly logoUrl: string | null;
  readonly verificationStatus: string;
  readonly verificationLevel: number;
  readonly trustScore: number;
  readonly isConnected: boolean;
  readonly connectionStatus: string | null;
}

export interface SupplierCatalogItem {
  readonly id: string;
  readonly organizationId: string;
  readonly productId: string;
  readonly catalogPrice: number;
  readonly currency: string;
  readonly moq: number;
  readonly leadTimeDays: number | null;
  readonly stockAvailability: SupplierCatalogStockAvailability;
  readonly isPublished: boolean;
  readonly catalogNotes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

/** Search result from the search_supplier_catalog RPC */
export interface SupplierCatalogSearchResult {
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly productSku: string | null;
  readonly catalogPrice: number;
  readonly currency: string;
  readonly moq: number;
  readonly leadTimeDays: number | null;
  readonly stockAvailability: string;
  readonly catalogNotes: string | null;
}

export interface CbnInvoice {
  readonly id: string;
  readonly organizationId: string;
  readonly counterpartyOrganizationId: string;
  readonly connectionId: string;
  readonly sourceInvoiceId: string;
  readonly invoiceNumber: string;
  readonly invoiceDate: string;
  readonly dueDate: string | null;
  readonly subtotal: number;
  readonly taxAmount: number;
  readonly totalAmount: number;
  readonly currency: string;
  readonly status: CbnSyncStatus;
  readonly acceptedAt: Date | null;
  readonly acceptedBy: string | null;
  readonly rejectedAt: Date | null;
  readonly rejectedBy: string | null;
  readonly rejectionReason: string | null;
  readonly buyerPurchaseInvoiceId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

export interface CbnPurchaseOrder {
  readonly id: string;
  readonly organizationId: string;
  readonly counterpartyOrganizationId: string;
  readonly connectionId: string;
  readonly sourcePurchaseOrderId: string;
  readonly poNumber: string;
  readonly poDate: string;
  readonly expectedDeliveryDate: string | null;
  readonly subtotal: number;
  readonly taxAmount: number;
  readonly totalAmount: number;
  readonly currency: string;
  readonly status: CbnPoSyncStatus;
  readonly acceptedAt: Date | null;
  readonly acceptedBy: string | null;
  readonly rejectedAt: Date | null;
  readonly rejectedBy: string | null;
  readonly rejectionReason: string | null;
  readonly supplierSalesOrderId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

export interface CbnSharedDocument {
  readonly id: string;
  readonly organizationId: string;
  readonly counterpartyOrganizationId: string;
  readonly connectionId: string;
  readonly documentType: SharedDocumentType;
  readonly documentReferenceType: string | null;
  readonly documentReferenceId: string | null;
  readonly documentNumber: string | null;
  readonly documentDate: string | null;
  readonly amount: number | null;
  readonly currency: string;
  readonly fileUrl: string | null;
  readonly fileName: string | null;
  readonly status: SharedDocumentStatus;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

export interface CbnEvent {
  readonly id: string;
  readonly organizationId: string;
  readonly connectionId: string | null;
  readonly eventType: string;
  readonly actorUserId: string | null;
  readonly sourceOrganizationId: string | null;
  readonly targetOrganizationId: string | null;
  readonly referenceType: string | null;
  readonly referenceId: string | null;
  readonly correlationId: string;
  readonly metadata: Json;
  readonly status: CbnEventStatus;
  readonly errorMessage: string | null;
  readonly createdAt: Date;
}

// ─────────────────────────────────────────────────────────────
// List param types
// ─────────────────────────────────────────────────────────────

export interface ConnectionListParams {
  readonly status?: ConnectionStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export interface CbnInvoiceListParams {
  readonly status?: CbnSyncStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export interface CbnPoListParams {
  readonly status?: CbnPoSyncStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export interface SharedDocumentListParams {
  readonly status?: SharedDocumentStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export interface CbnEventListParams {
  readonly eventType?: string;
  readonly limit?: number;
  readonly offset?: number;
}

// ─────────────────────────────────────────────────────────────
// Input types for services
// ─────────────────────────────────────────────────────────────

export interface ShareDocumentInput {
  readonly organizationId: string;
  readonly counterpartyOrganizationId: string;
  readonly connectionId: string;
  readonly documentType: SharedDocumentType;
  readonly documentReferenceType?: string | null;
  readonly documentReferenceId?: string | null;
  readonly documentNumber?: string | null;
  readonly documentDate?: string | null;
  readonly amount?: number | null;
  readonly currency?: string;
  readonly fileUrl?: string | null;
  readonly fileName?: string | null;
  readonly notes?: string | null;
}

// ─────────────────────────────────────────────────────────────
// Trust score
// ─────────────────────────────────────────────────────────────

export interface TrustScoreComponents {
  readonly paymentRating: number;
  readonly deliveryRating: number;
  readonly disputeScore: number;
  readonly customerRating: number;
}
