import { describe, expect, it, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/tests/utils';
import { OutstandingReportView } from './outstanding-report-view';
import type { OutstandingReport } from '../types/report.types';

vi.mock('../services/outstanding-report.service', () => ({
  getOutstandingReport: vi.fn(),
}));

import { getOutstandingReport } from '../services/outstanding-report.service';

const getOutstandingReportMock = vi.mocked(getOutstandingReport);

function makeReport(overrides: Partial<OutstandingReport> = {}): OutstandingReport {
  return {
    customers: [
      {
        customerId: 'cust-1',
        customerName: 'Kumar Traders',
        customerCode: 'CUST-001',
        outstanding: 1180,
        overdue: 500,
      },
    ],
    suppliers: [
      {
        supplierId: 'sup-1',
        supplierName: 'Mehta Suppliers',
        supplierCode: 'SUP-001',
        outstanding: 800,
      },
    ],
    totalReceivable: 1180,
    totalPayable: 800,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OutstandingReportView', () => {
  it('renders the heading, summary cards and customer receivables by default', () => {
    render(<OutstandingReportView initialData={makeReport()} orgId="org-1" />);

    expect(screen.getByRole('heading', { name: /outstanding report/i })).toBeInTheDocument();
    expect(screen.getByText('Total Receivable')).toBeInTheDocument();
    expect(screen.getByText('Total Payable')).toBeInTheDocument();
    expect(screen.getByText('Kumar Traders')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /customer receivables/i })).toBeInTheDocument();
  });

  it('switches to the supplier payables tab', async () => {
    const user = userEvent.setup();
    render(<OutstandingReportView initialData={makeReport()} orgId="org-1" />);

    await user.click(screen.getByRole('tab', { name: /supplier payables/i }));

    expect(screen.getByText('Mehta Suppliers')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /supplier payables/i })).toBeInTheDocument();
    expect(screen.queryByText('Kumar Traders')).not.toBeInTheDocument();
  });

  it('renders an em dash when a customer has no overdue amount', () => {
    render(
      <OutstandingReportView
        initialData={makeReport({
          customers: [
            {
              customerId: 'cust-2',
              customerName: 'Paid Up Co',
              customerCode: 'CUST-002',
              outstanding: 200,
              overdue: 0,
            },
          ],
        })}
        orgId="org-1"
      />
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows the empty state and disables export when there are no receivables', () => {
    render(
      <OutstandingReportView
        initialData={makeReport({ customers: [], totalReceivable: 0 })}
        orgId="org-1"
      />
    );

    expect(screen.getByText(/no outstanding receivables/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /export customer receivables csv/i })
    ).toBeDisabled();
  });

  it('shows the empty state for payables', async () => {
    const user = userEvent.setup();
    render(
      <OutstandingReportView
        initialData={makeReport({ suppliers: [], totalPayable: 0 })}
        orgId="org-1"
      />
    );

    await user.click(screen.getByRole('tab', { name: /supplier payables/i }));
    expect(screen.getByText(/no outstanding payables/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /export supplier payables csv/i })
    ).toBeDisabled();
  });

  it('refetches data when refresh is clicked', async () => {
    const user = userEvent.setup();
    getOutstandingReportMock.mockResolvedValue(
      makeReport({
        customers: [
          {
            customerId: 'cust-9',
            customerName: 'New Customer',
            customerCode: 'CUST-009',
            outstanding: 99,
            overdue: 0,
          },
        ],
      })
    );

    render(<OutstandingReportView initialData={makeReport()} orgId="org-1" />);
    await user.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => {
      expect(getOutstandingReportMock).toHaveBeenCalledWith(expect.anything(), 'org-1');
    });
    expect(await screen.findByText('New Customer')).toBeInTheDocument();
  });

  it('surfaces an error when the refetch fails', async () => {
    const user = userEvent.setup();
    getOutstandingReportMock.mockRejectedValue(new Error('Boom'));

    render(<OutstandingReportView initialData={makeReport()} orgId="org-1" />);
    await user.click(screen.getByRole('button', { name: /refresh/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Boom');
  });

  it('exports the customer receivables CSV as a download', async () => {
    const user = userEvent.setup();
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    const revokeUrl = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    render(<OutstandingReportView initialData={makeReport()} orgId="org-1" />);
    await user.click(screen.getByRole('button', { name: /export customer receivables csv/i }));

    expect(createUrl).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeUrl).toHaveBeenCalledWith('blob:fake');

    createUrl.mockRestore();
    revokeUrl.mockRestore();
    clickSpy.mockRestore();
  });

  it('exports the supplier payables CSV as a download', async () => {
    const user = userEvent.setup();
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    const revokeUrl = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    render(<OutstandingReportView initialData={makeReport()} orgId="org-1" />);
    await user.click(screen.getByRole('tab', { name: /supplier payables/i }));
    await user.click(screen.getByRole('button', { name: /export supplier payables csv/i }));

    expect(clickSpy).toHaveBeenCalled();

    createUrl.mockRestore();
    revokeUrl.mockRestore();
    clickSpy.mockRestore();
  });
});
