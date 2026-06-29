'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DateRangeFilter } from '../types/report.types';

function getThisMonth(): DateRangeFilter {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  return { from, to };
}

function getLastMonth(): DateRangeFilter {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
  return { from, to };
}

function getThisQuarter(): DateRangeFilter {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3);
  const from = new Date(now.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
  const to = new Date(now.getFullYear(), quarter * 3 + 3, 0).toISOString().split('T')[0];
  return { from, to };
}

function getThisYear(): DateRangeFilter {
  const now = new Date();
  const from = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  const to = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
  return { from, to };
}

const PRESETS = [
  { label: 'This Month', getValue: getThisMonth },
  { label: 'Last Month', getValue: getLastMonth },
  { label: 'This Quarter', getValue: getThisQuarter },
  { label: 'This Year', getValue: getThisYear },
] as const;

interface ReportDateFilterProps {
  readonly value: DateRangeFilter;
  readonly onChange: (range: DateRangeFilter) => void;
}

export function ReportDateFilter({ value, onChange }: ReportDateFilterProps) {
  const [activePreset, setActivePreset] = useState<string | null>('This Month');

  function handlePreset(label: string, getValue: () => DateRangeFilter) {
    setActivePreset(label);
    onChange(getValue());
  }

  function handleFromChange(e: React.ChangeEvent<HTMLInputElement>) {
    setActivePreset(null);
    onChange({ ...value, from: e.target.value });
  }

  function handleToChange(e: React.ChangeEvent<HTMLInputElement>) {
    setActivePreset(null);
    onChange({ ...value, to: e.target.value });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Date range presets">
        {PRESETS.map((preset) => (
          <Button
            key={preset.label}
            variant={activePreset === preset.label ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePreset(preset.label, preset.getValue)}
            aria-pressed={activePreset === preset.label}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <label htmlFor="date-from" className="block text-xs font-medium text-gray-600 dark:text-slate-400">
            From
          </label>
          <Input
            id="date-from"
            type="date"
            value={value.from}
            onChange={handleFromChange}
            className="h-9 w-auto"
            aria-label="Start date"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="date-to" className="block text-xs font-medium text-gray-600 dark:text-slate-400">
            To
          </label>
          <Input
            id="date-to"
            type="date"
            value={value.to}
            onChange={handleToChange}
            className="h-9 w-auto"
            aria-label="End date"
          />
        </div>
      </div>
    </div>
  );
}
