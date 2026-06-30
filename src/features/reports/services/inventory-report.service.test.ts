import { describe, it, expect, vi } from 'vitest';
import { getInventoryReport } from './inventory-report.service';
import type { SupabaseClient } from '@supabase/supabase-js';

function createMockSupabase(returnData: unknown, error: unknown = null) {
  const thenable = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    then(
      resolve: (value: { data: unknown; error: unknown }) => void,
      _reject?: (reason?: unknown) => void
    ) {
      resolve({ data: returnData, error });
    },
  };
  thenable.select.mockReturnValue(thenable);
  thenable.eq.mockReturnValue(thenable);
  thenable.is.mockReturnValue(thenable);

  return {
    from: vi.fn().mockReturnValue(thenable),
  } as unknown as SupabaseClient;
}

describe('getInventoryReport', () => {
  it('classifies stock statuses correctly', async () => {
    const mockData = [
      {
        product_id: 'prod-1',
        quantity: 50,
        products: { id: 'prod-1', name: 'Widget A', code: 'WA', reorder_level: 10 },
      },
      {
        product_id: 'prod-2',
        quantity: 5,
        products: { id: 'prod-2', name: 'Widget B', code: 'WB', reorder_level: 10 },
      },
      {
        product_id: 'prod-3',
        quantity: 0,
        products: { id: 'prod-3', name: 'Widget C', code: 'WC', reorder_level: 5 },
      },
    ];

    const supabase = createMockSupabase(mockData);
    const report = await getInventoryReport(supabase, 'org-1');

    expect(report.items).toHaveLength(3);

    const wa = report.items.find((i) => i.productId === 'prod-1');
    expect(wa?.status).toBe('in_stock');

    const wb = report.items.find((i) => i.productId === 'prod-2');
    expect(wb?.status).toBe('low_stock');

    const wc = report.items.find((i) => i.productId === 'prod-3');
    expect(wc?.status).toBe('out_of_stock');

    expect(report.totals.totalProducts).toBe(3);
    expect(report.totals.inStock).toBe(1);
    expect(report.totals.lowStock).toBe(1);
    expect(report.totals.outOfStock).toBe(1);
  });

  it('sums quantities across branches for same product', async () => {
    const mockData = [
      {
        product_id: 'prod-1',
        quantity: 30,
        products: { id: 'prod-1', name: 'Widget A', code: 'WA', reorder_level: 10 },
      },
      {
        product_id: 'prod-1',
        quantity: 20,
        products: { id: 'prod-1', name: 'Widget A', code: 'WA', reorder_level: 10 },
      },
    ];

    const supabase = createMockSupabase(mockData);
    const report = await getInventoryReport(supabase, 'org-1');

    expect(report.items).toHaveLength(1);
    expect(report.items[0].currentStock).toBe(50);
    expect(report.items[0].status).toBe('in_stock');
  });

  it('returns empty report when no inventory found', async () => {
    const supabase = createMockSupabase([]);
    const report = await getInventoryReport(supabase, 'org-1');

    expect(report.items).toHaveLength(0);
    expect(report.totals).toEqual({
      totalProducts: 0,
      inStock: 0,
      lowStock: 0,
      outOfStock: 0,
    });
  });

  it('throws when supabase returns an error', async () => {
    const supabase = createMockSupabase(null, { message: 'Inventory DB error' });
    await expect(getInventoryReport(supabase, 'org-1')).rejects.toThrow(
      'Inventory DB error'
    );
  });
});
