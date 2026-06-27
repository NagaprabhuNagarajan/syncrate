import { describe, expect, it, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/tests/utils';
import { GstReportView } from './gst-report-view';
import type { GstReport } from '../types/report.types';

vi.mock('../services/gst-report.service', () => ({
  getGstReport: vi.fn(),
}));

import { getGstReport } from '../services/gst-report.service';

const getGstReportMock = vi.mocked(getGstReport);

function makeReport(overrides: Partial<GstReport> = {}): GstReport {
  return {
    lines: [
      {
        month: '2026-06',
        taxableAmount: 1000,
        cgstAmount: 90,
        sgstAmount: 90,
        igstAmount: 0,
        totalTax: 180,
      },
    ],
    totals: {
      taxableAmount: 1000,
      cgstAmount: 90,
      sgstAmount: 90,
      igstAmount: 0,
      totalTax: 180,
    },
    dateRange: { from: '2026-06-01', to: '2026-06-30' },
    ...overrides,
  };
}

function emptyReport(): GstReport {
  return makeReport({
    lines: [],
    totals: { taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalTax: 0 },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GstReportView', () => {
  it('renders the heading, summary cards and the breakdown rows', () => {
    render(<GstReportView initialData={makeReport()} orgId="org-1" />);

    expect(screen.getByRole('heading', { name: /gst summary/i })).toBeInTheDocument();
    expect(screen.getByText('Total CGST')).toBeInTheDocument();
    expect(screen.getByText('Total IGST')).toBeInTheDocument();
    expect(screen.getByText('2026-06')).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: /taxable amount/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /monthly gst breakdown/i })).toBeInTheDocument();
  });

  it('shows the empty state and disables export when there is no data', () => {
    render(<GstReportView initialData={emptyReport()} orgId="org-1" />);

    expect(screen.getByText(/no gst data found/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export gst csv/i })).toBeDisabled();
  });

  it('refetches and renders new data when the date range changes', async () => {
    const user = userEvent.setup();
    getGstReportMock.mockResolvedValue(
      makeReport({
        lines: [
          {
            month: '2026-05',
            taxableAmount: 500,
            cgstAmount: 45,
            sgstAmount: 45,
            igstAmount: 0,
            totalTax: 90,
          },
        ],
      })
    );

    render(<GstReportView initialData={makeReport()} orgId="org-1" />);
    await user.click(screen.getByRole('button', { name: 'Last Month' }));

    await waitFor(() => {
      expect(getGstReportMock).toHaveBeenCalledWith(
        expect.anything(),
        'org-1',
        expect.objectContaining({ from: expect.any(String), to: expect.any(String) })
      );
    });
    expect(await screen.findByText('2026-05')).toBeInTheDocument();
  });

  it('surfaces an error when the refetch fails', async () => {
    const user = userEvent.setup();
    getGstReportMock.mockRejectedValue(new Error('Boom'));

    render(<GstReportView initialData={makeReport()} orgId="org-1" />);
    await user.click(screen.getByRole('button', { name: 'Last Month' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Boom');
  });

  it('exports the GST CSV as a download', async () => {
    const user = userEvent.setup();
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    const revokeUrl = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    render(<GstReportView initialData={makeReport()} orgId="org-1" />);
    await user.click(screen.getByRole('button', { name: /export gst csv/i }));

    expect(createUrl).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeUrl).toHaveBeenCalledWith('blob:fake');

    createUrl.mockRestore();
    revokeUrl.mockRestore();
    clickSpy.mockRestore();
  });
});
