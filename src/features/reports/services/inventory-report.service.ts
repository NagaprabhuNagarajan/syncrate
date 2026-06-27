import type { SupabaseClient } from '@supabase/supabase-js';
import type { InventoryReport, InventoryRow } from '../types/report.types';

type InventoryQueryRow = {
  product_id: string;
  quantity: number;
  products: {
    id: string;
    name: string;
    code: string;
    reorder_level: number;
  };
};

export async function getInventoryReport(
  supabase: SupabaseClient,
  orgId: string
): Promise<InventoryReport> {
  const { data, error } = await supabase
    .from('inventory')
    .select('product_id, quantity, products!inner(id, name, code, reorder_level, organization_id)')
    .eq('products.organization_id', orgId)
    .is('products.deleted_at', null);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as InventoryQueryRow[];

  const productMap = new Map<
    string,
    { name: string; code: string; reorderLevel: number; currentStock: number }
  >();

  for (const row of rows) {
    const product = row.products;
    const existing = productMap.get(row.product_id);
    if (existing) {
      existing.currentStock += row.quantity;
    } else {
      productMap.set(row.product_id, {
        name: product.name,
        code: product.code,
        reorderLevel: product.reorder_level,
        currentStock: row.quantity,
      });
    }
  }

  const items: InventoryRow[] = Array.from(productMap.entries())
    .map(([productId, p]) => {
      let status: 'in_stock' | 'low_stock' | 'out_of_stock';
      if (p.currentStock === 0) {
        status = 'out_of_stock';
      } else if (p.currentStock <= p.reorderLevel) {
        status = 'low_stock';
      } else {
        status = 'in_stock';
      }
      return {
        productId,
        productName: p.name,
        productCode: p.code,
        currentStock: p.currentStock,
        reorderLevel: p.reorderLevel,
        status,
      };
    })
    .sort((a, b) => a.productName.localeCompare(b.productName));

  const totals = {
    totalProducts: items.length,
    inStock: items.filter((i) => i.status === 'in_stock').length,
    lowStock: items.filter((i) => i.status === 'low_stock').length,
    outOfStock: items.filter((i) => i.status === 'out_of_stock').length,
  };

  return { items, totals };
}
