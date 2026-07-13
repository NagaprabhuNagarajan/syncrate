import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/tests/utils';
import { ReportsHub, type ReportsHubStats } from './reports-hub';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

const STATS: ReportsHubStats = {
  sales: { primary: '₹1.18L', secondary: '12 invoices · this month' },
  purchases: { primary: '₹84,000', secondary: '7 bills · this month' },
  inventory: {
    primary: '48',
    secondary: 'SKUs · 3 low · 1 out of stock',
    alert: true,
  },
  gst: { primary: '₹9,200', secondary: 'Total tax · this month' },
  outstanding: {
    primary: '₹42,000',
    secondary: 'Receivable · ₹18,000 payable',
  },
};

describe('ReportsHub', () => {
  it('renders the page heading and description', () => {
    render(<ReportsHub />);
    expect(
      screen.getByRole('heading', { name: /^reports$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/view and export business reports/i)
    ).toBeInTheDocument();
  });

  it('renders a card for each report with its title', () => {
    render(<ReportsHub />);
    expect(screen.getByText('Sales Report')).toBeInTheDocument();
    expect(screen.getByText('Purchase Report')).toBeInTheDocument();
    expect(screen.getByText('Inventory Report')).toBeInTheDocument();
    expect(screen.getByText('GST Summary')).toBeInTheDocument();
    expect(screen.getByText('Outstanding Report')).toBeInTheDocument();
  });

  it('links each report card to its route', () => {
    render(<ReportsHub />);
    const links = screen.getAllByRole('link', { name: /view report/i });
    expect(links).toHaveLength(5);
    const hrefs = links.map((link) => link.getAttribute('href'));
    // Grouped: Financial (sales, purchases, gst, outstanding) then Operations (inventory).
    expect(hrefs).toEqual([
      '/reports/sales',
      '/reports/purchases',
      '/reports/gst',
      '/reports/outstanding',
      '/reports/inventory',
    ]);
  });

  it('groups the reports under category headings', () => {
    render(<ReportsHub />);
    expect(
      screen.getByRole('heading', { name: /^financial$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /^operations$/i })
    ).toBeInTheDocument();
  });

  it('shows the live headline figures when stats are provided', () => {
    render(<ReportsHub stats={STATS} />);
    expect(screen.getByText('₹1.18L')).toBeInTheDocument();
    expect(screen.getByText('12 invoices · this month')).toBeInTheDocument();
    expect(screen.getByText('₹9,200')).toBeInTheDocument();
    expect(
      screen.getByText('SKUs · 3 low · 1 out of stock')
    ).toBeInTheDocument();
  });

  it('falls back to a dash when no stats are available', () => {
    render(<ReportsHub />);
    // Each card renders an em dash placeholder for its missing figure.
    expect(screen.getAllByText('—')).toHaveLength(5);
  });
});
