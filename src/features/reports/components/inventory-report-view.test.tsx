import { describe, expect, it, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/tests/utils';
import { InventoryReportView } from './inventory-report-view';
import type { InventoryReport, InventoryRow } from '../types/report.types';

vi.mock('../services/inventory-report.service', () => ({
  getInventoryReport: vi.fn(),
}));

import { getInventoryReport } from '../services/inventory-report.service';

const getInventoryReportMock = vi.mocked(getInventoryReport);

const ROWS: InventoryRow[] = [
  {
    productId: 'p-1',
    productName: 'Steel Bolt',
    productCode: 'SKU-001',
    currentStock: 100,
    reorderLevel: 20,
    status: 'in_stock',
  },
  {
    productId: 'p-2',
    productName: 'Copper Wire',
    productCode: 'SKU-002',
    currentStock: 5,
    reorderLevel: 10,
    status: 'low_stock',
  },
  {
    productId: 'p-3',
    productName: 'Brass Nut',
    productCode: 'SKU-003',
    currentStock: 0,
    reorderLevel: 15,
    status: 'out_of_stock',
  },
];

function makeReport(overrides: Partial<InventoryReport> = {}): InventoryReport {
  return {
    items: ROWS,
    totals: { totalProducts: 3, inStock: 1, lowStock: 1, outOfStock: 1 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InventoryReportView', () => {
  it('renders the heading, summary cards and all rows', () => {
    render(<InventoryReportView initialData={makeReport()} orgId="org-1" />);

    expect(screen.getByRole('heading', { name: /inventory report/i })).toBeInTheDocument();
    expect(screen.getByText('Total Products')).toBeInTheDocument();
    expect(screen.getByText('Steel Bolt')).toBeInTheDocument();
    expect(screen.getByText('Copper Wire')).toBeInTheDocument();
    expect(screen.getByText('Brass Nut')).toBeInTheDocument();
  });

  it('filters rows by the selected stock-status tab', async () => {
    const user = userEvent.setup();
    render(<InventoryReportView initialData={makeReport()} orgId="org-1" />);

    await user.click(screen.getByRole('tab', { name: 'Low Stock' }));
    expect(screen.getByText('Copper Wire')).toBeInTheDocument();
    expect(screen.queryByText('Steel Bolt')).not.toBeInTheDocument();
    expect(screen.queryByText('Brass Nut')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Low Stock' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('shows the empty state when a tab has no matching rows', async () => {
    const user = userEvent.setup();
    render(
      <InventoryReportView
        initialData={makeReport({ items: [ROWS[0]] })}
        orgId="org-1"
      />
    );

    await user.click(screen.getByRole('tab', { name: 'Out of Stock' }));
    expect(screen.getByText(/no products found/i)).toBeInTheDocument();
  });

  it('shows the empty state and disables export when there are no products', () => {
    render(
      <InventoryReportView
        initialData={makeReport({
          items: [],
          totals: { totalProducts: 0, inStock: 0, lowStock: 0, outOfStock: 0 },
        })}
        orgId="org-1"
      />
    );

    expect(screen.getByText(/no products found/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export inventory csv/i })).toBeDisabled();
  });

  it('refetches data when refresh is clicked', async () => {
    const user = userEvent.setup();
    getInventoryReportMock.mockResolvedValue(
      makeReport({
        items: [
          {
            productId: 'p-9',
            productName: 'Titanium Rod',
            productCode: 'SKU-009',
            currentStock: 50,
            reorderLevel: 10,
            status: 'in_stock',
          },
        ],
      })
    );

    render(<InventoryReportView initialData={makeReport()} orgId="org-1" />);
    await user.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => {
      expect(getInventoryReportMock).toHaveBeenCalledWith(expect.anything(), 'org-1');
    });
    expect(await screen.findByText('Titanium Rod')).toBeInTheDocument();
  });

  it('surfaces an error when the refetch fails', async () => {
    const user = userEvent.setup();
    getInventoryReportMock.mockRejectedValue(new Error('Boom'));

    render(<InventoryReportView initialData={makeReport()} orgId="org-1" />);
    await user.click(screen.getByRole('button', { name: /refresh/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Boom');
  });

  it('exports the inventory CSV as a download', async () => {
    const user = userEvent.setup();
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    const revokeUrl = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    render(<InventoryReportView initialData={makeReport()} orgId="org-1" />);
    await user.click(screen.getByRole('button', { name: /export inventory csv/i }));

    expect(createUrl).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeUrl).toHaveBeenCalledWith('blob:fake');

    createUrl.mockRestore();
    revokeUrl.mockRestore();
    clickSpy.mockRestore();
  });
});
