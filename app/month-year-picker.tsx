'use client';

import { MOIS_NOMS, selectableYears, buildMonthLabel, parseMonthLabel } from '@/lib/months';

interface Props {
  value: string; // "Aout 2026"
  onChange: (label: string) => void;
  allowAll?: boolean;
  allLabel?: string;
  className?: string;
}

export default function MonthYearPicker({ value, onChange, allowAll, allLabel = 'Toute la periode', className }: Props) {
  const parsed = value === '__ALL__' ? null : parseMonthLabel(value);
  const years = selectableYears();

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      {allowAll && (
        <button
          onClick={() => onChange('__ALL__')}
          className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
            value === '__ALL__' ? 'bg-forest text-white border-forest' : 'bg-white text-ink/60 border-black/10'
          }`}
        >
          {allLabel}
        </button>
      )}
      <select
        value={parsed ? parsed.monthNum : ''}
        onChange={(e) => {
          const monthNum = Number(e.target.value);
          const year = parsed ? parsed.year : new Date().getFullYear();
          onChange(buildMonthLabel(year, monthNum));
        }}
        className="border border-black/10 rounded-md px-3 py-2 text-sm bg-white"
      >
        {MOIS_NOMS.map((m, i) => (
          <option key={m} value={i + 1}>{m}</option>
        ))}
      </select>
      <select
        value={parsed ? parsed.year : new Date().getFullYear()}
        onChange={(e) => {
          const year = Number(e.target.value);
          const monthNum = parsed ? parsed.monthNum : new Date().getMonth() + 1;
          onChange(buildMonthLabel(year, monthNum));
        }}
        className="border border-black/10 rounded-md px-3 py-2 text-sm bg-white"
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}
