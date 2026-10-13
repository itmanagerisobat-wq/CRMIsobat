'use client';

import { useEffect, useMemo, useState } from 'react';
import { Rdv, AccordPrincipe } from '@/lib/types';
import { colorForName } from '@/lib/palette';
import { buildMonthLabel } from '@/lib/months';
import { REGIONS, regionCodeForDept } from '@/lib/regions';
import { deptFromCp } from '@/lib/b2c-flow';
import MonthYearPicker from '../month-year-picker';

interface Req { id: string; agent_name: string | null; date: string | null; status: string; created_at: string; confirmation_statut: string | null; valide_at: string | null; code_postal: string | null; departement: string | null }


function monthOf(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m] = String(iso).slice(0, 10).split('-').map((n) => parseInt(n, 10));
  return y && m ? buildMonthLabel(y, m) : '';
}

/** Statistiques de la responsable B2C : uniquement RDV envoyes par les agents B2C, accords de principe et relance. */
export default function ResponsableB2cStats() {
  const [rdv, setRdv] = useState<Rdv[]>([]);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [aps, setAps] = useState<AccordPrincipe[]>([]);
  const [statutsRelance, setStatutsRelance] = useState<string[]>([]);
  const [statutsAp, setStatutsAp] = useState<string[]>([]);
  const [statutsConf, setStatutsConf] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState('__ALL__');

  useEffect(() => {
    Promise.all([
      fetch('/api/rdv', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/b2c-rdv', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/accords-principe?univers=b2c', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/parametres', { cache: 'no-store' }).then((r) => r.json()),
    ]).then(([a, b, c, p]) => {
      setRdv(a.data || []);
      setReqs(b.data || []);
      setAps(c.data || []);
      setStatutsRelance(p.data?.statuts_relance || []);
      setStatutsAp(p.data?.statuts_ap || []);
      setStatutsConf(p.data?.statuts_confirmation_b2c || []);
    }).finally(() => setLoading(false));
  }, []);

  const inMonth = (iso: string | null | undefined) => month === '__ALL__' || monthOf(iso) === month;
  const rdvF = useMemo(() => rdv.filter((r) => month === '__ALL__' || r.month === month), [rdv, month]);
  const reqF = useMemo(() => reqs.filter((q) => inMonth(q.date || q.created_at)), [reqs, month]); // eslint-disable-line react-hooks/exhaustive-deps
  const apF = useMemo(() => aps.filter((x) => inMonth(x.created_at)), [aps, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const statutOf = (q: Req) => q.confirmation_statut || 'A confirmer';
  const regionOf = (q: Req): string => {
    const dept = deptFromCp(q.code_postal) || (q.departement ? String(q.departement).slice(0, 2) : null);
    const rc = dept ? regionCodeForDept(dept) : null;
    return rc ? REGIONS[rc] : 'Non renseignee';
  };

  const agents = useMemo(() => {
    const names = new Set<string>();
    reqF.forEach((q) => q.agent_name && names.add(q.agent_name));
    apF.forEach((x) => x.agent_name && names.add(x.agent_name));
    return Array.from(names).sort().map((n) => {
      const mine = reqF.filter((q) => q.agent_name === n);
      return {
        name: n,
        envoyes: mine.length,
        valides: mine.filter((q) => !!q.valide_at).length,
        parStatut: Object.fromEntries(statutsConf.map((st) => [st, mine.filter((q) => !!q.valide_at && statutOf(q) === st).length])),
        ap: apF.filter((x) => x.agent_name === n).length,
      };
    });
  }, [reqF, apF, statutsConf]); // eslint-disable-line react-hooks/exhaustive-deps

  const regions = useMemo(() => {
    const map = new Map<string, Req[]>();
    reqF.forEach((q) => { const r = regionOf(q); map.set(r, [...(map.get(r) || []), q]); });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length).map(([name, list]) => ({
      name,
      envoyes: list.length,
      valides: list.filter((q) => !!q.valide_at).length,
      parStatut: Object.fromEntries(statutsConf.map((st) => [st, list.filter((q) => !!q.valide_at && statutOf(q) === st).length])),
    }));
  }, [reqF, statutsConf]); // eslint-disable-line react-hooks/exhaustive-deps

  const Chip = ({ label, n, color }: { label: string; n: number; color?: string }) => (
    <span className="rounded-md px-3 py-1.5 text-xs text-white whitespace-nowrap" style={{ backgroundColor: color || '#1f2937' }}>
      {label} <strong className="ml-1 text-base">{n}</strong>
    </span>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-ink">Statistiques B2C</h1>
        <MonthYearPicker value={month} onChange={setMonth} allowAll allLabel="Tous les mois" />
      </div>
      {loading && <p className="text-ink/40 text-sm">Chargement...</p>}

      <Section title="📅 RDV envoyes par les agents — confirmation">
        <Chip label="Total envoyes" n={reqF.length} />
        <Chip label="A valider" n={reqF.filter((q) => !q.valide_at).length} color="#6b7280" />
        <Chip label="Valides" n={reqF.filter((q) => !!q.valide_at).length} color="#0e7490" />
        {statutsConf.map((st) => (
          <Chip key={st} label={st} n={reqF.filter((q) => !!q.valide_at && statutOf(q) === st).length} color={colorForName(st, statutsConf)} />
        ))}
      </Section>

      <Section title="🔔 Statuts de relance (RDV valides des agents)">
        <Chip label="Total suivi" n={rdvF.length} />
        {statutsRelance.map((st) => (
          <Chip key={st} label={st} n={rdvF.filter((r) => r.statut_relance === st).length} color={colorForName(st, statutsRelance)} />
        ))}
        <Chip label="Sans statut" n={rdvF.filter((r) => !r.statut_relance).length} color="#9ca3af" />
      </Section>

      <Section title="📝 Accords de principe">
        <Chip label="Total" n={apF.length} />
        {statutsAp.map((st) => (
          <Chip key={st} label={st} n={apF.filter((x) => x.statut === st).length} color={colorForName(st, statutsAp)} />
        ))}
        <Chip label="Sans statut" n={apF.filter((x) => !x.statut).length} color="#9ca3af" />
      </Section>

      <StatTable
        title="Par agent"
        firstCol="Agent"
        statuts={statutsConf}
        rows={agents.map((a) => ({ name: a.name, envoyes: a.envoyes, valides: a.valides, parStatut: a.parStatut, extra: a.ap }))}
        extraLabel="Accords de principe"
      />
      <StatTable
        title="Par region"
        firstCol="Region"
        statuts={statutsConf}
        rows={regions.map((r) => ({ name: r.name, envoyes: r.envoyes, valides: r.valides, parStatut: r.parStatut }))}
      />
    </div>
  );
}

function StatTable({ title, firstCol, statuts, rows, extraLabel }: {
  title: string; firstCol: string; statuts: string[];
  rows: { name: string; envoyes: number; valides: number; parStatut: Record<string, number>; extra?: number }[];
  extraLabel?: string;
}) {
  return (
    <>
      <h2 className="text-sm font-semibold text-ink/60 mt-6 mb-2">{title}</h2>
      <div className="bg-white rounded-lg border border-black/5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-forest-light text-forest-dark text-left text-xs uppercase tracking-wide">
              <th className="px-3 py-2">{firstCol}</th><th className="px-3 py-2">Envoyes</th><th className="px-3 py-2">Valides</th>
              {statuts.map((st) => <th key={st} className="px-3 py-2">{st}</th>)}
              {extraLabel && <th className="px-3 py-2">{extraLabel}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4 + statuts.length} className="text-center py-6 text-ink/40">Aucune donnee.</td></tr>}
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-black/5">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2">{r.envoyes}</td>
                <td className="px-3 py-2">{r.valides}</td>
                {statuts.map((st) => <td key={st} className="px-3 py-2">{r.parStatut[st] || 0}</td>)}
                {extraLabel && <td className="px-3 py-2">{r.extra ?? 0}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-ink/60 mb-2">{title}</h2>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
