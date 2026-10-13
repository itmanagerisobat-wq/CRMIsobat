'use client';

import { useEffect, useMemo, useState } from 'react';
import { Rdv } from '@/lib/types';
import { monthWeeks, formatDDMM } from '@/lib/weeks';
import { buildMonthLabel } from '@/lib/months';
import { useRole } from '@/lib/use-role';
import { useUnivers } from '@/lib/use-univers';
import MonthYearPicker from '../month-year-picker';
import NewRdvModal from './new-rdv-modal';
import PhasePopup from './phase-popup';
import CommercialPopup from './commercial-popup';
import StatutPopup from './statut-popup';
import SousStatutPopup from './sous-statut-popup';
import ReportHistoryPopup from './report-history-popup';
import DocumentPopup from './document-popup';
import RdvTable from './rdv-table';
import Alertes from './alertes';
import AujourdhuiBanner from './aujourdhui-banner';
import DemandesBanner from './demandes-banner';
import B2cDemandesBanner from './b2c-demandes-banner';
import ConfirmationPanel from '../confirmation/confirmation-panel';
import { computePhase } from '@/lib/pipeline';
import { textIncludes } from '@/lib/text-match';

const WEEKS = [1, 2, 3, 4, 5, 6];

const STATUT_FILTERS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'honore', label: 'Honore (tous)' },
  { value: 'honore:Devis signe', label: '  > Devis signe' },
  { value: 'honore:KO', label: '  > KO' },
  { value: 'honore:En cours de verification', label: '  > En cours de verification' },
  { value: 'non honore', label: 'Non honore' },
  { value: 'Non confirme', label: 'Non confirme' },
  { value: 'Annule', label: 'Annule' },
  { value: 'Reporte', label: 'Reporte' },
];

export default function PlanningPage() {
  const role = useRole();
  const univers = useUnivers();
  const canEdit = role !== 'viewer';
  const now = new Date();
  const [month, setMonth] = useState(buildMonthLabel(now.getFullYear(), now.getMonth() + 1));
  const [week, setWeek] = useState(1);
  // a l'ouverture, on se place sur la semaine en cours (et pas toujours la semaine 1)
  useEffect(() => {
    const iso = new Date().toISOString().slice(0, 10);
    const [y, m] = iso.split('-').map((n) => parseInt(n, 10));
    const cur = monthWeeks(buildMonthLabel(y, m));
    const t = new Date(iso + 'T00:00:00Z');
    const idx = cur.findIndex((rg: any) => t >= rg.start && t <= rg.end);
    if (idx >= 0) setWeek(idx + 1);
  }, []);
  const [monthView, setMonthView] = useState(false);
  const [statutFilter, setStatutFilter] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<Rdv[]>([]);
  const [trashAll, setTrashRows] = useState<Rdv[]>([]);
  const trashRows = trashAll.filter((x) => (x.type_client || 'b2b') === univers);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Rdv | null>(null);
  const [qualiteEditing, setQualiteEditing] = useState<Rdv | null>(null);
  const [commercialEditing, setCommercialEditing] = useState<Rdv | null>(null);
  const [sousStatutEditing, setSousStatutEditing] = useState<Rdv | null>(null);
  const [reportHistoryFor, setReportHistoryFor] = useState<Rdv | null>(null);
  const [documentEditing, setDocumentEditing] = useState<Rdv | null>(null);
  const [statutEditing, setStatutEditing] = useState<Rdv | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [params, setParams] = useState<Record<string, string[]>>({});
  const sousStatutColors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const entry of params.couleurs_sous_statuts || []) {
      const [sousStatut, couleur] = entry.split('=');
      if (sousStatut && couleur) map[sousStatut] = couleur;
    }
    return map;
  }, [params.couleurs_sous_statuts]);
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);
  const [showNonConforme, setShowNonConforme] = useState(false);
  const [showAnnule, setShowAnnule] = useState(false);
  const [showFermee, setShowFermee] = useState(false);
  const [showTrash, setShowTrash] = useState(false);

  useEffect(() => {
    fetch('/api/parametres', { cache: 'no-store' }).then((r) => r.json()).then((j) => setParams(j.data || {}));
  }, []);

  const seuilHeures = parseInt((params.seuil_alerte_phase_heures || ['24'])[0], 10) || 24;

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ month });
    if (!monthView) qs.set('week', String(week));
    const res = await fetch(`/api/rdv?${qs.toString()}`, { cache: 'no-store' });
    const json = await res.json();
    setRows(json.data || []);
    setLoading(false);
  }

  async function loadTrash() {
    const res = await fetch('/api/rdv?trash=1', { cache: 'no-store' });
    const json = await res.json();
    setTrashRows(json.data || []);
  }

  async function restoreFromTrash(id: string) {
    await fetch(`/api/rdv/${id}`, { method: 'PUT' });
    loadTrash();
    load();
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, week, monthView]);

  // Une fois par jour et par navigateur : remet les RDV dans la bonne semaine d'apres leur date (reports anciens, week-ends)
  useEffect(() => {
    if (role !== 'admin' && role !== 'gestionnaire') return;
    try {
      const key = 'isobat_weeks_repaired';
      const today = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem(key) === today) return;
      fetch('/api/rdv/repair-weeks', { method: 'POST' })
        .then((r) => r.json())
        .then((j) => { localStorage.setItem(key, today); if (j.fixed > 0) load(); })
        .catch(() => {});
    } catch { /* storage indisponible */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    loadTrash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const weekRanges = useMemo(() => monthWeeks(month), [month]);

  useEffect(() => {
    if (weekRanges.length > 0 && week > weekRanges.length) setWeek(1);
  }, [weekRanges, week]);

  const filteredRows = useMemo(() => {
    let r = rows.filter((x) => (x.type_client || 'b2b') === univers);
    if (statutFilter) {
      if (statutFilter.includes(':')) {
        const [st, sub] = statutFilter.split(':');
        r = r.filter((x) => x.statut === st && x.sous_statut === sub);
      } else {
        r = r.filter((x) => x.statut === statutFilter);
      }
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter((x) =>
        (x.client || '').toLowerCase().includes(q) ||
        (x.raison_sociale || '').toLowerCase().includes(q) ||
        (x.prestataire || '').toLowerCase().includes(q) ||
        (x.commercial || '').toLowerCase().includes(q) ||
        (x.telephone || '').toLowerCase().includes(q) ||
        (x.code_postal || '').toLowerCase().includes(q)
      );
    }
    return r;
  }, [rows, statutFilter, search, univers]);

  const operationsFermees = params.operations_fermees || [];

  const grouped = useMemo(() => {
    const g = { qualite: [] as Rdv[], affectation: [] as Rdv[], visite: [] as Rdv[], nonConforme: [] as Rdv[], annule: [] as Rdv[], fermee: [] as Rdv[] };
    for (const r of filteredRows) {
      const isFermee = textIncludes(r.qualite_resultat, 'ferm') || textIncludes(r.statut, 'ferm') ||
        (r.operation ? operationsFermees.includes(r.operation) : false);
      if (isFermee) { g.fermee.push(r); continue; }
      if (r.qualite_non_conforme) { g.nonConforme.push(r); continue; }
      if (r.qualite_annule || r.statut === 'Annule') { g.annule.push(r); continue; }
      const phase = computePhase(r);
      if (phase === 'qualite') g.qualite.push(r);
      else if (phase === 'affectation') g.affectation.push(r);
      else if (phase === 'visite' || phase === 'retour') g.visite.push(r);
      // 'closed' with a real sous_statut (successfully wrapped up) isn't shown in any of these groups
    }
    // Most recent first, everywhere.
    const byDateDesc = (a: Rdv, b: Rdv) => (b.date || '').localeCompare(a.date || '') || (b.heure || '').localeCompare(a.heure || '');
    g.qualite.sort(byDateDesc);
    g.affectation.sort(byDateDesc);
    g.visite.sort(byDateDesc);
    g.nonConforme.sort(byDateDesc);
    g.annule.sort(byDateDesc);
    g.fermee.sort(byDateDesc);
    return g;
  }, [filteredRows, operationsFermees]);

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce RDV ?')) return;
    await fetch(`/api/rdv/${id}`, { method: 'DELETE' });
    load();
  }

  async function handleExport(format: 'xlsx' | 'pdf') {
    setExporting(format);
    const res = await fetch(`/api/export/${format}?month=${encodeURIComponent(month)}`);
    if (!res.ok) {
      alert("Erreur lors de l'export.");
      setExporting(null);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Planning_${month.replace(' ', '_')}.${format === 'xlsx' ? 'xlsx' : 'pdf'}`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(null);
  }

  const statutBadge = (s: string | null, sub: string | null) => {
    const map: Record<string, string> = {
      'non honore': 'bg-statut-nonhonore/15 text-statut-nonhonore',
      honore: 'bg-statut-honore/15 text-statut-honore',
      Reporte: 'bg-statut-reporte/15 text-statut-reporte',
      Annule: 'bg-statut-annule/15 text-statut-annule line-through',
      'Non confirme': 'bg-orange-100 text-orange-700',
    };
    if (!s) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-ink/10 text-ink/60">Confirme</span>;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${map[s] || ''}`}>
        {s}
      </span>
    );
  };

  return (
    <div>
      {(role === 'admin' || role === 'gestionnaire' || role === 'responsable_b2c') && (univers === 'b2c' ? <B2cDemandesBanner onChange={load} /> : <DemandesBanner onChange={load} />)}
      <Alertes />
      <AujourdhuiBanner params={params} canEdit={canEdit} />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Planning</h1>
          <p className="text-ink/60 text-sm">Saisie et suivi des RDV commerciaux.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthYearPicker value={month} onChange={setMonth} />
          <div className="flex bg-white border border-black/10 rounded-md overflow-hidden text-sm">
            <button
              onClick={() => setMonthView(false)}
              className={`px-3 py-2 font-medium ${!monthView ? 'bg-forest text-white' : 'text-ink/60'}`}
            >
              Par semaine
            </button>
            <button
              onClick={() => setMonthView(true)}
              className={`px-3 py-2 font-medium ${monthView ? 'bg-forest text-white' : 'text-ink/60'}`}
            >
              Mois entier
            </button>
          </div>
          <button
            onClick={() => handleExport('xlsx')}
            disabled={exporting !== null}
            className="bg-white border border-black/10 hover:bg-forest-light text-ink text-sm font-medium px-3 py-2 rounded-md transition-colors disabled:opacity-60"
          >
            {exporting === 'xlsx' ? 'Export...' : '\u2913 Excel'}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
            className="bg-white border border-black/10 hover:bg-forest-light text-ink text-sm font-medium px-3 py-2 rounded-md transition-colors disabled:opacity-60"
          >
            {exporting === 'pdf' ? 'Export...' : '\u2913 PDF'}
          </button>
          {canEdit && (
            <button
              onClick={() => { setAddingNew(true); setEditing(null); }}
              className="bg-forest hover:bg-forest-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
            >
              + Nouveau RDV
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        {!monthView && (
          <div className="flex gap-1">
            {WEEKS.filter((w) => weekRanges[w - 1]).map((w) => {
              const range = weekRanges[w - 1];
              return (
                <button
                  key={w}
                  onClick={() => setWeek(w)}
                  title={range ? `${formatDDMM(range.start)} - ${formatDDMM(range.end)}` : undefined}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    week === w ? 'bg-gold text-white' : 'bg-white text-ink/70 border border-black/10 hover:bg-gold-light'
                  }`}
                >
                  Semaine {w}{range ? ` (${formatDDMM(range.start)}-${formatDDMM(range.end)})` : ''}
                </button>
              );
            })}
          </div>
        )}

        <select
          value={statutFilter}
          onChange={(e) => setStatutFilter(e.target.value)}
          className="border border-black/10 rounded-md px-3 py-2 text-sm bg-white"
        >
          {STATUT_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher client / prestataire / commercial / telephone / code postal..."
          className="flex-1 min-w-[220px] border border-black/10 rounded-md px-3 py-2 text-sm bg-white"
        />
      </div>

      <div className="text-sm text-ink/60 mb-3 flex items-center justify-between">
        <span>
          <span className="font-semibold text-ink">{filteredRows.length}</span> RDV affiche(s)
          {statutFilter || search ? ' (filtre applique)' : ''}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowNonConforme((v) => !v); setShowAnnule(false); }}
            className={`text-xs font-medium px-3 py-1.5 rounded-md border transition-colors ${
              showNonConforme ? 'bg-statut-annule text-white border-statut-annule' : 'bg-white border-black/10 text-ink/60 hover:bg-statut-annule/5'
            }`}
          >
            RDV non conforme ({grouped.nonConforme.length})
          </button>
          <button
            onClick={() => { setShowAnnule((v) => !v); setShowNonConforme(false); setShowFermee(false); }}
            className={`text-xs font-medium px-3 py-1.5 rounded-md border transition-colors ${
              showAnnule ? 'bg-statut-annule text-white border-statut-annule' : 'bg-white border-black/10 text-ink/60 hover:bg-statut-annule/5'
            }`}
          >
            RDV annule ({grouped.annule.length})
          </button>
          <button
            onClick={() => { setShowFermee((v) => !v); setShowNonConforme(false); setShowAnnule(false); setShowTrash(false); }}
            className={`text-xs font-medium px-3 py-1.5 rounded-md border transition-colors ${
              showFermee ? 'bg-ink text-white border-ink' : 'bg-white border-black/10 text-ink/60 hover:bg-ink/5'
            }`}
          >
            RDV operations fermees ({grouped.fermee.length})
          </button>
          <button
            onClick={() => { const next = !showTrash; setShowTrash(next); setShowNonConforme(false); setShowAnnule(false); setShowFermee(false); if (next) loadTrash(); }}
            className={`text-xs font-medium px-3 py-1.5 rounded-md border transition-colors ${
              showTrash ? 'bg-ink text-white border-ink' : 'bg-white border-black/10 text-ink/60 hover:bg-ink/5'
            }`}
          >
            🗑️ RDV supprime ({trashRows.length})
          </button>
        </div>
      </div>

      {showNonConforme ? (
        <section className="mb-6">
          <h2 className="text-lg font-extrabold text-statut-annule uppercase tracking-wide mb-3 text-center">RDV non conforme</h2>
          <RdvTable rows={grouped.nonConforme} canEdit={canEdit} seuilHeures={seuilHeures} statutBadge={statutBadge} onEdit={(r) => { setEditing(r); setAddingNew(false); }} onDelete={handleDelete} onQualite={(r) => setQualiteEditing(r)} onDocument={(r) => setDocumentEditing(r)} accent="red" onReportHistory={(r) => setReportHistoryFor(r)} />
        </section>
      ) : showAnnule ? (
        <section className="mb-6">
          <h2 className="text-lg font-extrabold text-statut-annule uppercase tracking-wide mb-3 text-center">RDV annule</h2>
          <p className="text-xs text-ink/50 text-center mb-3">
            Utilise le bouton "Qualite" pour rouvrir un dossier annule par erreur.
          </p>
          <RdvTable rows={grouped.annule} canEdit={canEdit} seuilHeures={seuilHeures} statutBadge={statutBadge} onEdit={(r) => { setEditing(r); setAddingNew(false); }} onDelete={handleDelete} onQualite={(r) => setQualiteEditing(r)} onStatut={(r) => setStatutEditing(r)} onDocument={(r) => setDocumentEditing(r)} accent="red" onReportHistory={(r) => setReportHistoryFor(r)} />
        </section>
      ) : showFermee ? (
        <section className="mb-6">
          <h2 className="text-lg font-extrabold text-ink uppercase tracking-wide mb-3 text-center">RDV operations fermees</h2>
          <p className="text-xs text-ink/50 text-center mb-3">
            RDV lies a une operation sur laquelle on ne travaille plus. Change le statut pour les rouvrir.
          </p>
          <RdvTable rows={grouped.fermee} canEdit={canEdit} seuilHeures={seuilHeures} statutBadge={statutBadge} onEdit={(r) => { setEditing(r); setAddingNew(false); }} onDelete={handleDelete} onQualite={(r) => setQualiteEditing(r)} onStatut={(r) => setStatutEditing(r)} onDocument={(r) => setDocumentEditing(r)} accent="red" onReportHistory={(r) => setReportHistoryFor(r)} />
        </section>
      ) : showTrash ? (
        <section className="mb-6">
          <h2 className="text-lg font-extrabold text-ink uppercase tracking-wide mb-3 text-center">🗑️ RDV supprime</h2>
          <p className="text-xs text-ink/50 text-center mb-3">
            RDV supprimes de Planning. Ils ne sont pas effaces definitivement -- tu peux les restaurer.
          </p>
          <RdvTable rows={trashRows} canEdit={canEdit} seuilHeures={seuilHeures} statutBadge={statutBadge} onEdit={() => {}} onDelete={() => {}} onRestore={restoreFromTrash} trashMode accent="red" />
        </section>
      ) : (
        <>
          <section className="mb-6">
            {univers === 'b2c' ? (
              <ConfirmationPanel embedded />
            ) : (<>
            <h2 className="text-2xl font-extrabold text-gold uppercase tracking-wide mb-3 text-center">RDV en attente de validation</h2>
            <RdvTable rows={grouped.qualite} canEdit={canEdit} seuilHeures={seuilHeures} statutBadge={statutBadge} onEdit={(r) => { setEditing(r); setAddingNew(false); }} onDelete={handleDelete} onQualite={(r) => setQualiteEditing(r)} onDocument={(r) => setDocumentEditing(r)} qualiteMode accent="gold" onReportHistory={(r) => setReportHistoryFor(r)} />
            </>)}
          </section>
          <section className="mb-6">
            <h2 className="text-2xl font-extrabold text-blue-600 uppercase tracking-wide mb-3 text-center">RDV confirmes &amp; affectes</h2>
            <RdvTable rows={grouped.affectation} canEdit={canEdit} seuilHeures={seuilHeures} statutBadge={statutBadge} onEdit={(r) => { setEditing(r); setAddingNew(false); }} onDelete={handleDelete} onCommercial={(r) => setCommercialEditing(r)} onStatut={(r) => setStatutEditing(r)} onDocument={(r) => setDocumentEditing(r)} confirmeMode accent="blue" onReportHistory={(r) => setReportHistoryFor(r)} />
          </section>
          <section className="mb-6">
            <h2 className="text-2xl font-extrabold text-forest uppercase tracking-wide mb-3 text-center">Visites realisees</h2>
            <RdvTable rows={grouped.visite} canEdit={canEdit} seuilHeures={seuilHeures} statutBadge={statutBadge} onEdit={(r) => { setEditing(r); setAddingNew(false); }} onDelete={handleDelete} onSousStatut={(r) => setSousStatutEditing(r)} onDocument={(r) => setDocumentEditing(r)} honoreMode sousStatutColors={sousStatutColors} accent="forest" onReportHistory={(r) => setReportHistoryFor(r)} />
          </section>
        </>
      )}

      {addingNew && (
        <NewRdvModal
          month={month}
          week={week}
          params={params}
          onClose={() => setAddingNew(false)}
          onSaved={() => { setAddingNew(false); load(); }}
        />
      )}
      {qualiteEditing && (
        <PhasePopup
          rdv={qualiteEditing}
          params={params}
          onClose={() => setQualiteEditing(null)}
          onSaved={() => { setQualiteEditing(null); load(); }}
          forceQualite
        />
      )}
      {commercialEditing && (
        <CommercialPopup
          rdv={commercialEditing}
          params={params}
          onClose={() => setCommercialEditing(null)}
          onSaved={() => { setCommercialEditing(null); load(); }}
        />
      )}
      {statutEditing && (
        <StatutPopup
          rdv={statutEditing}
          params={params}
          onClose={() => setStatutEditing(null)}
          onSaved={() => { setStatutEditing(null); load(); }}
        />
      )}
      {sousStatutEditing && (
        <SousStatutPopup
          rdv={sousStatutEditing}
          params={params}
          onClose={() => setSousStatutEditing(null)}
          onSaved={() => { setSousStatutEditing(null); load(); }}
        />
      )}
      {reportHistoryFor && (
        <ReportHistoryPopup rdv={reportHistoryFor} onClose={() => setReportHistoryFor(null)} />
      )}
      {documentEditing && (
        <DocumentPopup
          rdv={documentEditing}
          params={params}
          onClose={() => setDocumentEditing(null)}
          onSaved={() => { setDocumentEditing(null); load(); }}
        />
      )}
      {editing && (
        <PhasePopup
          rdv={editing}
          params={params}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          intakeOnly
        />
      )}
    </div>
  );
}
