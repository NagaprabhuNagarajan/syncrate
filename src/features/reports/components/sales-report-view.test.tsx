import { describe, expect, it, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/tests/utils';
import { SalesReportView } from './sales-report-view';
import type { SalesReport } from '../types/report.types';

vi.mock('../services/sales-report.service', () => ({
  getSalesReport: vi.fn(),
}));

import { getSalesReport } from '../services/sales-report.service';

const getSalesReportMock = vi.mocked(getSalesReport);

function makeReport(overrides: Partial<SalesReport> = {}): SalesReport {
  return {
    summary: [
      {
        period: '2026-06',
        invoiceCount: 3,
        subtotal: 1000,
        taxAmount: 180,
        totalAmount: 1180,
        amountPaid: 1000,
        outstanding: 180,
      },
    ],
    byCustomer: [
      {
        customerId: 'cust-1',
        customerName: 'Kumar Traders',
        customerCode: 'CUST-001',
        invoiceCount: 3,
        totalAmount: 1180,
        amountPaid: 1000,
        outstanding: 180,
      },
    ],
    totals: {
      subtotal: 1000,
      taxAmount: 180,
      totalAmount: 1180,
      amountPaid: 1000,
      outstanding: 180,
    },
    dateRange: { from: '2026-06-01', to: '2026-06-30' },
    ...overrides,
  };
}

function emptyReport(): SalesReport {
  return makeReport({
    summary: [],
    byCustomer: [],
    totals: { subtotal: 0, taxAmount: 0, totalAmount: 0, amountPaid: 0, outstanding: 0 },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SalesReportView', () => {
  it('renders the heading and the summary and customer rows', () => {
    render(<SalesReportView initialData={makeReport()} orgId="org-1" />);

    expect(screen.getByRole('heading', { name: /sales report/i })).toBeInTheDocument();
    expect(screen.getByText('2026-06')).toBeInTheDocument();
    expect(screen.getByText('Kumar Traders')).toBeInTheDocument();
    expect(screen.getByText('CUST-001')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /monthly sales summary/i })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /sales by customer/i })).toBeInTheDocument();
  });

  it('shows empty states and disables exports when there is no data', () => {
    render(<SalesReportView initialData={emptyReport()} orgId="org-1" />);

    expect(screen.getByText(/no sales data found/i)).toBeInTheDocument();
    expect(screen.getByText(/no customer data found/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export summary csv/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /export by-customer csv/i })).toBeDisabled();
  });

  it('refetches and renders new data when the date range changes', async () => {
    const user = userEvent.setup();
    getSalesReportMock.mockResolvedValue(
      makeReport({
        byCustomer: [
          {
            customerId: 'cust-2',
            customerName: 'Mehta Suppliers',
            customerCode: 'CUST-002',
            invoiceCount: 1,
            totalAmount: 500,
            amountPaid: 500,
            outstanding: 0,
          },
        ],
      })
    );

    render(<SalesReportView initialData={makeReport()} orgId="org-1" />);
    await user.click(screen.getByRole('button', { name: 'Last Month' }));

    await waitFor(() => {
      expect(getSalesReportMock).toHaveBeenCalledWith(
        expect.anything(),
        'org-1',
        expect.objectContaining({
          from: expect.any(String),
          to: expect.any(String),
        })
      );
    });
    expect(await screen.findByText('Mehta Suppliers')).toBeInTheDocument();
  });

  it('surfaces an error when the refetch fails', async () => {
    const user = userEvent.setup();
    getSalesReportMock.mockRejectedValue(new Error('Boom'));

    render(<SalesReportView initialData={makeReport()} orgId="org-1" />);
    await user.click(screen.getByRole('button', { name: 'Last Month' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Boom');
  });

  it('exports the summary CSV as a download', async () => {
    const user = userEvent.setup();
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    const revokeUrl = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    render(<SalesReportView initialData={makeReport()} orgId="org-1" />);
    await user.click(screen.getByRole('button', { name: /export summary csv/i }));

    expect(createUrl).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeUrl).toHaveBeenCalledWith('blob:fake');

    createUrl.mockRestore();
    revokeUrl.mockRestore();
    clickSpy.mockRestore();
  });

  it('exports the by-customer CSV as a download', async () => {
    const user = userEvent.setup();
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    const revokeUrl = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    render(<SalesReportView initialData={makeReport()} orgId="org-1" />);
    await user.click(screen.getByRole('button', { name: /export by-customer csv/i }));

    expect(clickSpy).toHaveBeenCalled();

    createUrl.mockRestore();
    revokeUrl.mockRestore();
    clickSpy.mockRestore();
  });
});
