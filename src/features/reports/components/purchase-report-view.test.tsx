import { describe, expect, it, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/tests/utils';
import { PurchaseReportView } from './purchase-report-view';
import type { PurchaseReport } from '../types/report.types';

vi.mock('../services/purchase-report.service', () => ({
  getPurchaseReport: vi.fn(),
}));

import { getPurchaseReport } from '../services/purchase-report.service';

const getPurchaseReportMock = vi.mocked(getPurchaseReport);

function makeReport(overrides: Partial<PurchaseReport> = {}): PurchaseReport {
  return {
    summary: [
      {
        period: '2026-06',
        invoiceCount: 2,
        totalAmount: 2360,
        amountPaid: 2000,
        outstanding: 360,
      },
    ],
    bySupplier: [
      {
        supplierId: 'sup-1',
        supplierName: 'Mehta Suppliers',
        supplierCode: 'SUP-001',
        invoiceCount: 2,
        totalAmount: 2360,
        amountPaid: 2000,
        outstanding: 360,
      },
    ],
    totals: { totalAmount: 2360, amountPaid: 2000, outstanding: 360 },
    dateRange: { from: '2026-06-01', to: '2026-06-30' },
    ...overrides,
  };
}

function emptyReport(): PurchaseReport {
  return makeReport({
    summary: [],
    bySupplier: [],
    totals: { totalAmount: 0, amountPaid: 0, outstanding: 0 },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PurchaseReportView', () => {
  it('renders the heading and the summary and supplier rows', () => {
    render(<PurchaseReportView initialData={makeReport()} orgId="org-1" />);

    expect(screen.getByRole('heading', { name: /purchase report/i })).toBeInTheDocument();
    expect(screen.getByText('2026-06')).toBeInTheDocument();
    expect(screen.getByText('Mehta Suppliers')).toBeInTheDocument();
    expect(screen.getByText('SUP-001')).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: /monthly purchase summary/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /purchases by supplier/i })).toBeInTheDocument();
  });

  it('shows empty states and disables exports when there is no data', () => {
    render(<PurchaseReportView initialData={emptyReport()} orgId="org-1" />);

    expect(screen.getByText(/no purchase data found/i)).toBeInTheDocument();
    expect(screen.getByText(/no supplier data found/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export summary csv/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /export by-supplier csv/i })).toBeDisabled();
  });

  it('refetches and renders new data when the date range changes', async () => {
    const user = userEvent.setup();
    getPurchaseReportMock.mockResolvedValue(
      makeReport({
        bySupplier: [
          {
            supplierId: 'sup-2',
            supplierName: 'Patel Industries',
            supplierCode: 'SUP-002',
            invoiceCount: 1,
            totalAmount: 700,
            amountPaid: 700,
            outstanding: 0,
          },
        ],
      })
    );

    render(<PurchaseReportView initialData={makeReport()} orgId="org-1" />);
    await user.click(screen.getByRole('button', { name: 'Last Month' }));

    await waitFor(() => {
      expect(getPurchaseReportMock).toHaveBeenCalledWith(
        expect.anything(),
        'org-1',
        expect.objectContaining({ from: expect.any(String), to: expect.any(String) })
      );
    });
    expect(await screen.findByText('Patel Industries')).toBeInTheDocument();
  });

  it('surfaces an error when the refetch fails', async () => {
    const user = userEvent.setup();
    getPurchaseReportMock.mockRejectedValue(new Error('Boom'));

    render(<PurchaseReportView initialData={makeReport()} orgId="org-1" />);
    await user.click(screen.getByRole('button', { name: 'Last Month' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Boom');
  });

  it('exports the summary and by-supplier CSVs as downloads', async () => {
    const user = userEvent.setup();
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    const revokeUrl = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    render(<PurchaseReportView initialData={makeReport()} orgId="org-1" />);
    await user.click(screen.getByRole('button', { name: /export summary csv/i }));
    await user.click(screen.getByRole('button', { name: /export by-supplier csv/i }));

    expect(clickSpy).toHaveBeenCalledTimes(2);
    expect(createUrl).toHaveBeenCalledTimes(2);
    expect(revokeUrl).toHaveBeenCalledWith('blob:fake');

    createUrl.mockRestore();
    revokeUrl.mockRestore();
    clickSpy.mockRestore();
  });
});
