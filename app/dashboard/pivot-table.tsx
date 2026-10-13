'use client';

interface Props {
  title: string;
  rowLabel: string;
  rows: string[];
  cols: string[];
  getValue: (row: string, col: string) => number;
}

export default function PivotTable({ title, rowLabel, rows, cols, getValue }: Props) {
  const rowTotals = rows.map((r) => cols.reduce((s, c) => s + getValue(r, c), 0));
  const colTotals = cols.map((c) => rows.reduce((s, r) => s + getValue(r, c), 0));
  const grandTotal = colTotals.reduce((s, v) => s + v, 0);

  return (
    <div className="bg-white rounded-lg border border-black/5 p-4">
      <h2 className="font-semibold text-ink mb-3">{title}</h2>
      {rows.length === 0 || cols.length === 0 ? (
        <p className="text-sm text-ink/40">Pas de donnees.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-forest-light text-forest-dark">
                <th className="px-2 py-1.5 text-left font-semibold sticky left-0 bg-forest-light">{rowLabel}</th>
                {cols.map((c) => (
                  <th key={c} className="px-2 py-1.5 text-center font-semibold whitespace-nowrap">{c}</th>
                ))}
                <th className="px-2 py-1.5 text-center font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r} className="border-t border-black/5 hover:bg-forest-light/30">
                  <td className="px-2 py-1.5 font-medium whitespace-nowrap sticky left-0 bg-white">{r}</td>
                  {cols.map((c) => {
                    const v = getValue(r, c);
                    return (
                      <td key={c} className={`px-2 py-1.5 text-center ${v > 0 ? 'text-ink' : 'text-ink/25'}`}>
                        {v}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-center font-semibold bg-gold-light/50">{rowTotals[i]}</td>
                </tr>
              ))}
              <tr className="border-t border-black/10 font-semibold bg-forest-light/40">
                <td className="px-2 py-1.5 sticky left-0 bg-forest-light/40">Total</td>
                {colTotals.map((v, i) => (
                  <td key={cols[i]} className="px-2 py-1.5 text-center">{v}</td>
                ))}
                <td className="px-2 py-1.5 text-center">{grandTotal}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
