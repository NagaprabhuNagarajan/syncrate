export interface DateRangeFilter {
  from: string;
  to: string;
}

export interface SalesSummaryRow {
  period: string;
  invoiceCount: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  outstanding: number;
}

export interface SalesByCustomerRow {
  customerId: string;
  customerName: string;
  customerCode: string;
  invoiceCount: number;
  totalAmount: number;
  amountPaid: number;
  outstanding: number;
}

export interface SalesReport {
  summary: SalesSummaryRow[];
  byCustomer: SalesByCustomerRow[];
  totals: {
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    amountPaid: number;
    outstanding: number;
  };
  dateRange: DateRangeFilter;
}

export interface PurchaseSummaryRow {
  period: string;
  invoiceCount: number;
  totalAmount: number;
  amountPaid: number;
  outstanding: number;
}

export interface PurchaseBySupplierRow {
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  invoiceCount: number;
  totalAmount: number;
  amountPaid: number;
  outstanding: number;
}

export interface PurchaseReport {
  summary: PurchaseSummaryRow[];
  bySupplier: PurchaseBySupplierRow[];
  totals: {
    totalAmount: number;
    amountPaid: number;
    outstanding: number;
  };
  dateRange: DateRangeFilter;
}

export interface InventoryRow {
  productId: string;
  productName: string;
  productCode: string;
  currentStock: number;
  reorderLevel: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

export interface InventoryReport {
  items: InventoryRow[];
  totals: {
    totalProducts: number;
    inStock: number;
    lowStock: number;
    outOfStock: number;
  };
}

export interface GstLineRow {
  month: string;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
}

export interface GstReport {
  lines: GstLineRow[];
  totals: {
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalTax: number;
  };
  dateRange: DateRangeFilter;
}

export interface CustomerOutstandingRow {
  customerId: string;
  customerName: string;
  customerCode: string;
  outstanding: number;
  overdue: number;
}

export interface SupplierOutstandingRow {
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  outstanding: number;
}

export interface OutstandingReport {
  customers: CustomerOutstandingRow[];
  suppliers: SupplierOutstandingRow[];
  totalReceivable: number;
  totalPayable: number;
}
