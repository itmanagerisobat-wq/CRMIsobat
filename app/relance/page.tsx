'use client';

import { Fragment, useEffect, useState, useRef } from 'react';
import { Rdv, AccordPrincipe } from '@/lib/types';
import { colorForName } from '@/lib/palette';
import { useRole } from '@/lib/use-role';
import { useUnivers } from '@/lib/use-univers';
import MonthYearPicker from '../month-year-picker';
import RelancePanel from './relance-panel';
import ApPanel from './ap-panel';
import DocumentPopup from '../planning/document-popup';
import AgentRdvTable, { AgentReq } from './agent-rdv-table';
import ConfirmationsRelance from './confirmations-relance';
import { buildMonthLabel } from '@/lib/months';
import { isHonore } from '@/lib/b2c-flow';

export default function RelancePage() {
  const role = useRole();
  const univers = useUnivers();
  const univRef = useRef(univers);
  univRef.current = univers;
  const canEdit = role === 'admin' || role === 'gestionnaire' || role === 'relanceur' || role === 'responsable_b2c';

  const [rows, setRows] = useState<Rdv[]>([]);
  const [apItems, setApItems] = useState<AccordPrincipe[]>([]);
  const [statutsAp, setStatutsAp] = useState<string[]>([]);
  const [statutsApRappel, setStatutsApRappel] = useState<string[]>([]);
  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<'relance' | 'ap' | 'rdv' | 'confirm'>('relance');
  const [confirmCount, setConfirmCount] = useState(0);
  const [papiersEntry, setPapiersEntry] = useState<string[]>([]);
  const [agentReqs, setAgentReqs] = useState<AgentReq[]>([]);
  const [files, setFiles] = useState<Record<string, { id: string; kind: string; filename: string }[]>>({});
  const [apExporting, setApExporting] = useState(false);
  const [papiersOk, setPapiersOk] = useState<string[]>([]);
  const [relanceList, setRelanceList] = useState<string[]>([]);
  const [statutsRelance, setStatutsRelance] = useState<string[]>([]);
  const [relanceurs, setRelanceurs] = useState<string[]>([]);
  const [documentsStatuts, setDocumentsStatuts] = useState<string[]>([]);
  const [documentEditing, setDocumentEditing] = useState<Rdv | null>(null);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState('__ALL__');
  const [exporting, setExporting] = useState(false);
  const [todayOnly, setTodayOnly] = useState(false);
  const [todayRdvIds, setTodayRdvIds] = useState<Set<string>>(new Set());

  async function loadTodayContacts() {
    const res = await fetch('/api/relance-log/today', { cache: 'no-store' });
    const json = await res.json();
    setTodayRdvIds(new Set((json.data || []).map((l: any) => l.rdv_id)));
  }

  async function load() {
    setLoading(true);
    const [paramsRes, rdvRes, apRes, reqRes, filesRes] = await Promise.all([
      fetch('/api/parametres', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/rdv', { cache: 'no-store' }).then((r) => r.json()),
      fetch(`/api/accords-principe?univers=${univers}`, { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/rdv-requests?status=all', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ data: [] })),
      fetch('/api/rdv-files', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ data: [] })),
    ]);
    if (univRef.current !== univers) return;
    const fmap: Record<string, { id: string; kind: string; filename: string }[]> = {};
    (filesRes.data || []).forEach((f: any) => { (fmap[f.rdv_id] ||= []).push(f); });
    setFiles(fmap);
    setAgentReqs((reqRes.data || []).filter((q: any) => (q.type_client || 'b2b') === univers));
    setPapiersOk(paramsRes.data?.statuts_papiers_ok || []);
    setPapiersEntry(paramsRes.data?.visite_vers_papiers || []);
    setRelanceList(paramsRes.data?.relance || []);
    setStatutsRelance(paramsRes.data?.statuts_relance || []);
    setStatutsAp(paramsRes.data?.statuts_ap || []);
    setStatutsApRappel(paramsRes.data?.statuts_ap_rappel || []);
    setRelanceurs(paramsRes.data?.relanceurs || []);
    setDocumentsStatuts(paramsRes.data?.documents_statuts || []);
    setRows((rdvRes.data || []).filter((r: Rdv) => (r.type_client || 'b2b') === univers));
    setApItems(apRes.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); loadTodayContacts(); }, [univers]);

  // A RDV enters this list either because its visit statut OR its
  // sous-statut (e.g. "Devis envoye", set once a visit is Honore) still
  // needs follow-up (per Parametres "relance" list, which can contain
  // either kind of value) OR because it already has a tracked
  // statut_relance -- once tracked, it never disappears again, even after
  // the quote is signed.
  // B2C : un RDV confirme (present au Planning) et honore entre en relance tant que le
  // statut papiers n'est pas positif ; une fois positif il reste en historique (grise).
  const papiersRecus = (r: Rdv) => univers === 'b2c' && isHonore(r.statut) && papiersOk.includes(r.papiers_statut || '');
  const matching = rows
    .filter((r) => relanceList.includes(r.statut || '') || relanceList.includes(r.sous_statut || '') || !!r.statut_relance
      || (univers === 'b2c' && isHonore(r.statut) && (papiersEntry.includes(r.sous_statut || '') || papiersEntry.includes(r.statut || ''))))
    .filter((r) => monthFilter === '__ALL__' || r.month === monthFilter)
    .filter((r) => !todayOnly || todayRdvIds.has(r.id));

  const todayIso = new Date().toISOString().slice(0, 10);
  const monthOf = (iso: string | null | undefined) => {
    if (!iso) return '';
    const [y, m] = String(iso).slice(0, 10).split('-').map((n) => parseInt(n, 10));
    return y && m ? buildMonthLabel(y, m) : '';
  };
  const apShown = apItems
    .filter((it) => monthFilter === '__ALL__' || monthOf(it.created_at) === monthFilter)
    .filter((it) => !todayOnly || String(it.date_prochain_rappel || '').slice(0, 10) === todayIso);
  const agentReqsShown = agentReqs
    .filter((q) => monthFilter === '__ALL__' || monthOf(q.date) === monthFilter)
    .filter((q) => !todayOnly || String(q.date || '').slice(0, 10) === todayIso);
  const todayCount = view === 'relance' ? todayRdvIds.size
    : view === 'ap' ? apItems.filter((it) => String(it.date_prochain_rappel || '').slice(0, 10) === todayIso).length
    : agentReqs.filter((q) => String(q.date || '').slice(0, 10) === todayIso).length;
  const todayLabel = view === 'relance' ? 'Prevues aujourd\'hui' : view === 'ap' ? 'Rappels aujourd\'hui' : 'RDV aujourd\'hui';

  const summary = statutsRelance.map((s) => ({
    statut: s,
    count: matching.filter((r) => r.statut_relance === s).length,
    color: colorForName(s, statutsRelance),
  }));
  const sansStatut = matching.filter((r) => !r.statut_relance).length;

  async function handleExport() {
    setExporting(true);
    const qs = new URLSearchParams();
    if (monthFilter !== '__ALL__') qs.set('month', monthFilter);
    const res = await fetch(`/api/export/relance?${qs.toString()}`);
    if (!res.ok) {
      alert("Erreur lors de l'export.");
      setExporting(false);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Relance${monthFilter !== '__ALL__' ? '_' + monthFilter.replace(' ', '_') : ''}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  async function handleExportAp() {
    setApExporting(true);
    const res = await fetch(`/api/export/accords-principe?univers=${univers}`);
    if (!res.ok) {
      alert("Erreur lors de l'export.");
      setApExporting(false);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Accords_de_principe.xlsx';
    a.click();
    URL.revokeObjectURL(url);
    setApExporting(false);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold text-ink">Relance</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTodayOnly((v) => !v)}
            className={`text-sm font-medium px-3 py-2 rounded-md border transition-colors ${
              todayOnly ? 'bg-gold text-white border-gold' : 'bg-white text-ink border-black/10 hover:bg-forest-light'
            }`}
          >
            📅 {todayLabel} {todayCount > 0 ? `(${todayCount})` : ''}
          </button>
          <MonthYearPicker value={monthFilter} onChange={setMonthFilter} allowAll allLabel="Tous les mois" />
          {view === 'relance' && <button
            onClick={handleExport}
            disabled={exporting || matching.length === 0}
            className="bg-white border border-black/10 hover:bg-forest-light text-ink text-sm font-medium px-3 py-2 rounded-md transition-colors disabled:opacity-50"
          >
            {exporting ? 'Export...' : '\u2913 Excel'}
          </button>}
          {view === 'ap' && <button
            onClick={handleExportAp}
            disabled={apExporting || apShown.length === 0}
            className="bg-white border border-black/10 hover:bg-forest-light text-ink text-sm font-medium px-3 py-2 rounded-md transition-colors disabled:opacity-50"
          >
            {apExporting ? 'Export...' : '\u2913 Excel'}
          </button>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {([
          ['relance', `🔔 Relance (${matching.length})`],
          ['ap', `📝 Accords de principe (${apShown.length})`],
          ['rdv', `📅 RDV pris par les agents (${agentReqsShown.length})`],
          ['confirm', `📞 Confirmations (${confirmCount})`],
        ] as const).filter(([k]) => !(k === 'rdv' && univers === 'b2c')).filter(([k]) => !(k === 'confirm' && univers !== 'b2c')).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            className={`text-sm font-medium px-3 py-2 rounded-md border transition-colors ${
              view === k ? 'bg-forest text-white border-forest' : 'bg-white text-ink border-black/10 hover:bg-forest-light'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {relanceList.length === 0 && !loading && (
        <div className="bg-gold-light text-ink rounded-md p-3 mb-4 text-sm">
          Aucun statut de visite n'est configure pour declencher une relance. Va dans{' '}
          <a href="/parametres" className="underline font-medium">Parametres</a> → "Statuts a
          relancer".
        </div>
      )}

      {view === 'relance' && summary.length > 0 && (
        <div className="flex flex-nowrap items-center gap-2 mb-3 overflow-x-auto pb-1">
          <span className="shrink-0 rounded-md px-2.5 py-1 text-xs text-white bg-ink whitespace-nowrap">
            Total suivi <strong className="ml-1 text-sm">{matching.length}</strong>
          </span>
          {summary.map((x) => (
            <span key={x.statut} className="shrink-0 rounded-md px-2.5 py-1 text-xs text-white whitespace-nowrap" style={{ backgroundColor: x.color }}>
              {x.statut} <strong className="ml-1 text-sm">{x.count}</strong>
            </span>
          ))}
          {sansStatut > 0 && (
            <span className="shrink-0 rounded-md px-2.5 py-1 text-xs text-white bg-ink/40 whitespace-nowrap">
              Sans statut <strong className="ml-1 text-sm">{sansStatut}</strong>
            </span>
          )}
        </div>
      )}

      {view === 'relance' && (
      <div className="bg-white rounded-lg border border-black/5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-forest-light text-forest-dark text-left">
              <Th>Mois</Th><Th>Responsable</Th><Th>Raison sociale</Th><Th>Telephone</Th>
              <Th>Suivi relance</Th>
              <Th>Document</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="text-center py-8 text-ink/40">Chargement...</td></tr>
            )}
            {!loading && matching.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-ink/40">Rien a relancer pour le moment.</td></tr>
            )}
            {matching.map((r) => (
              <Fragment key={r.id}>
              <tr className={`border-t border-black/5 hover:bg-forest-light/40 align-top ${papiersRecus(r) ? 'opacity-50' : ''}`}>
                <Td>{r.month}</Td>
                <Td>{r.client || '—'}{papiersRecus(r) && <span className="ml-1 text-[10px] font-semibold bg-black/10 rounded px-1">Papiers reçus</span>}</Td>
                <Td>{r.raison_sociale || '—'}</Td>
                <Td>{r.telephone || '—'}</Td>
                <Td>
                  <RelancePanel
                    rdv={r}
                    statutsRelance={statutsRelance}
                    relanceurs={relanceurs}
                    canEdit={canEdit}
                    onStatutChanged={(patch) => setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, ...patch } : x))}
                  />
                </Td>
                <Td>
                  {canEdit && (
                    <button
                      onClick={() => setDocumentEditing(r)}
                      className={`text-xs font-semibold ${r.document_statut ? 'text-gold' : 'text-ink/40'} hover:underline`}
                    >
                      {r.document_statut ? `📄 ${r.document_statut}` : '📄 Definir'}
                    </button>
                  )}
                </Td>
                <Td>
                  <button
                    onClick={() => setDetailsOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}
                    className="text-xs font-semibold text-forest hover:underline whitespace-nowrap"
                  >
                    {detailsOpen[r.id] ? 'Masquer' : 'Details'}
                  </button>
                </Td>
              </tr>
              {detailsOpen[r.id] && (
                <tr className="bg-forest-light/30">
                  <td colSpan={7} className="px-4 py-2 text-xs text-ink/80">
                    <div className="flex flex-wrap gap-x-8 gap-y-1">
                      <span><strong>Semaine :</strong> S{r.week_number}</span>
                      <span><strong>Date :</strong> {r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '—'}</span>
                      <span><strong>Operation :</strong> {r.operation || '—'}</span>
                      <span><strong>Commercial :</strong> {r.commercial || '—'}</span>
                      <span><strong>Statut visite :</strong> {r.statut || 'Confirme'}{r.sous_statut ? ` · ${r.sous_statut}` : ''}</span>
                      {r.agent_name && <span><strong>Agent :</strong> {r.agent_name}</span>}
                      <span>
                        <strong>Pieces jointes :</strong>{' '}
                        {(files[r.id] || []).length === 0 && '—'}
                        {(files[r.id] || []).map((f) => (
                          <a key={f.id} href={`/api/rdv-files/${f.id}`} target="_blank" rel="noreferrer" className="text-forest underline mr-3">
                            📎 {f.kind === 'devis' ? 'Devis' : 'NDD'} ({f.filename})
                          </a>
                        ))}
                      </span>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {view === 'ap' && (
        <div className="bg-white rounded-lg border border-black/5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-forest-light text-forest-dark text-left">
                <Th>Raison sociale</Th><Th>Responsable</Th><Th>Telephone</Th>
                <Th>Operation</Th><Th>Agent</Th><Th>Statut / Suivi</Th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="text-center py-8 text-ink/40">Chargement...</td></tr>
              )}
              {!loading && apShown.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-ink/40">Aucun accord de principe pour le moment.</td></tr>
              )}
              {apShown.map((item) => (
                <tr key={item.id} className="border-t border-black/5 hover:bg-forest-light/40 align-top">
                  <Td>{item.raison_sociale || '—'}</Td>
                  <Td>{item.client || '—'}</Td>
                  <Td>{item.telephone || '—'}</Td>
                  <Td>{item.operation || '—'}</Td>
                  <Td>{item.agent_name || '—'}</Td>
                  <Td>
                    <ApPanel
                      item={item}
                      statutsAp={statutsAp}
                      statutsApRappel={statutsApRappel}
                      canEdit={canEdit}
                      onChanged={(patch) => setApItems((its) => its.map((x) => x.id === item.id ? { ...x, ...patch } : x))}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {univers === 'b2c' && (
        <div className={view === 'confirm' ? '' : 'hidden'}>
          <ConfirmationsRelance canEdit={canEdit} todayOnly={todayOnly} onCount={setConfirmCount} />
        </div>
      )}

      {view === 'rdv' && (
        <AgentRdvTable
          rows={agentReqsShown}
          loading={loading}
          canManage={role === 'admin' || role === 'gestionnaire' || role === 'relanceur' || role === 'responsable_b2c'}
          canValidate={role === 'admin' || role === 'gestionnaire'}
          onChanged={load}
        />
      )}

      {documentEditing && (
        <DocumentPopup
          rdv={documentEditing}
          params={{ documents_statuts: documentsStatuts }}
          onClose={() => setDocumentEditing(null)}
          onSaved={() => {
            setDocumentEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wide">{children}</th>;
}
function Td({ children }: { children?: React.ReactNode }) {
  return <td className="px-3 py-2 whitespace-nowrap">{children}</td>;
}
