import { describe, expect, it, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, fireEvent } from '@/tests/utils';
import { ReportDateFilter } from './report-date-filter';
import type { DateRangeFilter } from '../types/report.types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function makeValue(overrides: Partial<DateRangeFilter> = {}): DateRangeFilter {
  return { from: '2026-06-01', to: '2026-06-30', ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ReportDateFilter', () => {
  it('renders all presets and the date inputs', () => {
    render(<ReportDateFilter value={makeValue()} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'This Month' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Last Month' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'This Quarter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'This Year' })).toBeInTheDocument();
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-06-01');
    expect(screen.getByLabelText('End date')).toHaveValue('2026-06-30');
  });

  it('marks "This Month" as the active preset by default', () => {
    render(<ReportDateFilter value={makeValue()} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'This Month' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Last Month' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('emits a valid range and updates the active preset when a preset is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ReportDateFilter value={makeValue()} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Last Month' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const range = onChange.mock.calls[0][0] as DateRangeFilter;
    expect(range.from).toMatch(DATE_RE);
    expect(range.to).toMatch(DATE_RE);
    expect(screen.getByRole('button', { name: 'Last Month' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'This Month' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('emits valid ranges for the quarter and year presets', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ReportDateFilter value={makeValue()} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'This Quarter' }));
    await user.click(screen.getByRole('button', { name: 'This Year' }));

    expect(onChange).toHaveBeenCalledTimes(2);
    for (const call of onChange.mock.calls) {
      const range = call[0] as DateRangeFilter;
      expect(range.from).toMatch(DATE_RE);
      expect(range.to).toMatch(DATE_RE);
    }
  });

  it('emits a custom "from" value and clears the active preset', () => {
    const onChange = vi.fn();
    render(<ReportDateFilter value={makeValue()} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2026-05-15' },
    });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-05-15', to: '2026-06-30' })
    );
    expect(screen.getByRole('button', { name: 'This Month' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('emits a custom "to" value', () => {
    const onChange = vi.fn();
    render(<ReportDateFilter value={makeValue()} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2026-06-15' },
    });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-06-01', to: '2026-06-15' })
    );
  });
});
