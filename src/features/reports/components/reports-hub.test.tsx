import { describe, expect, it } from 'vitest';
import { render, screen } from '@/tests/utils';
import { ReportsHub } from './reports-hub';

describe('ReportsHub', () => {
  it('renders the page heading and description', () => {
    render(<ReportsHub />);
    expect(screen.getByRole('heading', { name: /^reports$/i })).toBeInTheDocument();
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
    expect(hrefs).toEqual([
      '/reports/sales',
      '/reports/purchases',
      '/reports/inventory',
      '/reports/gst',
      '/reports/outstanding',
    ]);
  });
});
