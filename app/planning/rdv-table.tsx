'use client';

import { useState } from 'react';
import { Rdv } from '@/lib/types';
import { textIncludes } from '@/lib/text-match';

type Accent = 'gold' | 'blue' | 'forest' | 'red';

const ACCENT_CLASSES: Record<Accent, string> = {
  gold: 'bg-gold-light text-gold-dark',
  blue: 'bg-blue-100 text-blue-700',
  forest: 'bg-forest-light text-forest-dark',
  red: 'bg-statut-annule/10 text-statut-annule',
};

// Solid, full-cell fills for the Sous-statut column (color chosen per sous-statut in Parametres).
const SOLID_COLORS: Record<string, string> = {
  green: 'bg-green-600 text-white', blue: 'bg-blue-600 text-white', red: 'bg-red-600 text-white',
  orange: 'bg-orange-500 text-white', purple: 'bg-purple-600 text-white', yellow: 'bg-yellow-400 text-ink',
  gray: 'bg-ink/60 text-white', pink: 'bg-pink-500 text-white', teal: 'bg-teal-600 text-white',
  indigo: 'bg-indigo-600 text-white', amber: 'bg-amber-400 text-ink', black: 'bg-ink text-white',
};

interface Props {
  rows: Rdv[];
  canEdit: boolean;
  seuilHeures: number;
  statutBadge: (s: string | null, sub: string | null) => React.ReactNode;
  onEdit: (r: Rdv) => void;
  onDelete: (id: string) => void;
  onQualite?: (r: Rdv) => void;
  onCommercial?: (r: Rdv) => void;
  onStatut?: (r: Rdv) => void;
  accent?: Accent;
  qualiteMode?: boolean;
  statutHeaderLabel?: string;
  statutActionHeaderLabel?: string;
  trashMode?: boolean;
  onRestore?: (id: string) => void;
  sousStatutColors?: Record<string, string>;
  honoreMode?: boolean;
  onSousStatut?: (r: Rdv) => void;
  onDocument?: (r: Rdv) => void;
  /** "Confirmes & affectes": Statut always shows "Confirme"; the real value
   * (Reporte / Annule / Non confirme / Honore...) is shown in Sous-statut instead. */
  confirmeMode?: boolean;
  onReportHistory?: (r: Rdv) => void;
}

function QualiteStatutBadge({ rdv, seuilHeures }: { rdv: Rdv; seuilHeures: number }) {
  const resultat = rdv.qualite_resultat;
  const changedAt = rdv.phase_changee_le ? new Date(rdv.phase_changee_le) : rdv.created_at ? new Date(rdv.created_at) : null;
  const hoursIn = changedAt ? (Date.now() - changedAt.getTime()) / 36e5 : 0;
  const isLate = hoursIn >= seuilHeures;
  const lastCall = rdv.qualite_dernier_appel ? new Date(rdv.qualite_dernier_appel).toLocaleDateString('fr-FR') : null;

  if (!resultat) {
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold animate-pulse ${isLate ? 'bg-statut-annule text-white' : 'bg-gold text-white'}`}>
        En cours{isLate ? ' ⚠️' : ''}
      </span>
    );
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold animate-pulse ${isLate ? 'bg-statut-annule/20 text-statut-annule' : 'bg-gold/20 text-gold-dark'}`}>
      {resultat}{lastCall ? ` — ${lastCall}` : ''}
    </span>
  );
}

// Solid, full-cell fill for the main Statut column (Confirme / Reporte / Annule / Non confirme / Honore...).
function statutFillClass(s: string | null): string {
  if (!s) return 'bg-ink/10 text-ink/70';
  if (textIncludes(s, 'reporte')) return 'bg-purple-600 text-white';
  if (textIncludes(s, 'annule')) return 'bg-red-600 text-white line-through';
  if (textIncludes(s, 'non confirme')) return 'bg-orange-500 text-white';
  if (textIncludes(s, 'non honore')) return 'bg-sky-600 text-white';
  if (textIncludes(s, 'honore')) return 'bg-blue-600 text-white';
  return 'bg-ink/10 text-ink/70';
}

function ReportBadge({ r }: { r: Rdv }) {
  if (!((r.nombre_reports || 0) > 0)) return null;
  const n = r.nombre_reports || 0;
  return (
    <span
      className={`ml-1 inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white align-middle ${
        n === 1 ? 'bg-ink/40' : n === 2 ? 'bg-orange-500' : 'bg-statut-annule'
      }`}
      title={`Reporte ${n} fois`}
    >
      ↻{n}
    </span>
  );
}

export default function RdvTable({
  rows, canEdit, seuilHeures, onEdit, onDelete, onQualite, onCommercial, onStatut, accent = 'forest',
  qualiteMode = false, trashMode = false, onRestore, sousStatutColors = {}, honoreMode = false, onSousStatut, onDocument,
  confirmeMode = false, onReportHistory,
}: Props) {
  const headerClass = ACCENT_CLASSES[accent];
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const colCount = 11 + (onQualite ? 1 : 0);

  return (
    <div className="bg-white rounded-lg border border-black/5 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className={`${headerClass} text-left`}>
            <Th>Date</Th><Th>Heure</Th><Th>Agent</Th><Th>Operation</Th><Th>Commercial</Th><Th>Prestataire</Th>
            <Th>Raison sociale</Th><Th>Statut</Th><Th>Sous-statut</Th><Th>Commentaire</Th>
            {onQualite && <Th>Qualite</Th>}
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={colCount + 1} className="text-center py-6 text-ink/40 text-sm">Aucun dossier ici.</td></tr>
          )}
          {rows.map((r, idx) => {
            const hoursUntil = r.date ? (new Date(r.date).getTime() - Date.now()) / 36e5 : Infinity;
            const isUrgentNoCommercial = !r.commercial && hoursUntil >= 0 && hoursUntil <= 48;
            const isOpen = expanded.has(r.id);
            const zebra = idx % 2 === 1 ? 'bg-black/[0.015]' : '';
            const rowClass = isUrgentNoCommercial ? 'bg-statut-annule/10 animate-pulse' : zebra;

            const sousStatutColorName = r.sous_statut
              ? Object.entries(sousStatutColors).find(([key]) => textIncludes(r.sous_statut, key))?.[1]
              : null;
            const sousStatutFillClass = sousStatutColorName ? (SOLID_COLORS[sousStatutColorName] || 'bg-ink/50 text-white') : '';

            return (
              <>
                <tr key={r.id} className={`border-t border-black/5 hover:bg-forest-light/30 transition-colors ${rowClass}`}>
                  <Td>{r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '—'}</Td>
                  <Td>{r.heure || '—'}</Td>
                  <Td>{r.agent_name || '—'}</Td>
                  <Td className="font-medium text-ink">{r.operation || '—'}</Td>
                  <Td>
                    <div>{r.commercial || <span className="text-ink/40">—</span>}</div>
                    {onCommercial && canEdit && (
                      <button
                        onClick={() => onCommercial(r)}
                        className={
                          r.commercial
                            ? 'text-blue-600 hover:underline text-[11px] font-semibold'
                            : 'text-statut-annule hover:underline text-sm font-extrabold animate-pulse'
                        }
                      >
                        {r.commercial ? 'Changer' : 'Affecter'}
                      </button>
                    )}
                  </Td>
                  <Td>{r.prestataire || '—'}</Td>
                  <Td className="font-medium text-ink">{r.raison_sociale || '—'}</Td>
                  {(() => {
                    // The action to change the "real" value: honoreMode edits sous_statut,
                    // everything else (confirmeMode included) edits statut.
                    const editHandler = honoreMode ? onSousStatut : onStatut;
                    const hasReports = (r.nombre_reports || 0) > 0;
                    return (
                      <>
                        <Td className="p-0 align-middle">
                          {qualiteMode ? (
                            <div className="px-3 py-2"><QualiteStatutBadge rdv={r} seuilHeures={seuilHeures} /></div>
                          ) : honoreMode ? (
                            <div className="px-3 py-2 bg-blue-600 text-white text-sm font-bold">
                              Honore
                              {editHandler && canEdit && (
                                <div className="mt-0.5">
                                  <button onClick={() => editHandler(r)} className="underline text-[11px] font-semibold opacity-90 hover:opacity-100">
                                    {r.sous_statut ? 'Modifier' : 'Definir'}
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : confirmeMode ? (
                            <div className="px-3 py-2 bg-ink/10 text-ink/70 text-sm font-bold">
                              Confirme
                              {editHandler && canEdit && (
                                <div className="mt-0.5">
                                  <button onClick={() => editHandler(r)} className="underline text-[11px] font-semibold opacity-90 hover:opacity-100">
                                    {r.statut ? 'Modifier' : 'Definir'}
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className={`px-3 py-2 text-sm font-bold ${statutFillClass(r.statut)}`}>
                              {r.statut ? r.statut : 'Confirme'}
                              {r.statut === 'honore' && !r.sous_statut && (
                                <span className="ml-1 inline-block w-2 h-2 rounded-full bg-orange-300 align-middle" title="A traiter : retour de visite manquant" />
                              )}
                              {editHandler && canEdit && (
                                <div className="mt-0.5">
                                  <button onClick={() => editHandler(r)} className="underline text-[11px] font-semibold opacity-90 hover:opacity-100">
                                    {r.statut ? 'Modifier' : 'Definir'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </Td>
                        <Td className="p-0 align-middle">
                          {confirmeMode ? (
                            <div className={r.statut ? `px-3 py-2 text-base font-extrabold whitespace-nowrap ${statutFillClass(r.statut)}` : 'px-3 py-2'}>
                              {r.statut ? r.statut : <span className="text-ink/30">—</span>}
                              <ReportBadge r={r} />
                              {hasReports && onReportHistory && (
                                <div className="mt-0.5">
                                  <button onClick={() => onReportHistory(r)} className={`underline text-[11px] font-semibold ${r.statut ? 'opacity-90 hover:opacity-100' : 'text-forest'}`}>
                                    Details
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : r.sous_statut ? (
                            <div className={`px-3 py-2 text-base font-extrabold whitespace-nowrap ${sousStatutFillClass}`}>
                              {r.sous_statut}
                              <ReportBadge r={r} />
                              {hasReports && onReportHistory && (
                                <div className="mt-0.5">
                                  <button onClick={() => onReportHistory(r)} className="underline text-[11px] font-semibold opacity-90 hover:opacity-100">
                                    Details
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="px-3 py-2">
                              <span className="text-ink/30">—</span>
                              {hasReports && onReportHistory && (
                                <div className="mt-0.5">
                                  <button onClick={() => onReportHistory(r)} className="text-forest hover:underline text-[11px] font-semibold">
                                    Details
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </Td>
                      </>
                    );
                  })()}
                  <Td className="max-w-[220px] truncate" title={r.motif || undefined}>
                    {r.motif || <span className="text-ink/30">—</span>}
                    {onDocument && canEdit && (
                      <button
                        onClick={() => onDocument(r)}
                        title={r.document_note || r.document_statut || 'Ajouter un statut document'}
                        className={`ml-1.5 inline-block text-xs ${r.document_statut ? 'text-gold font-bold' : 'text-ink/20'}`}
                      >
                        📄
                      </button>
                    )}
                  </Td>
                  {onQualite && (
                    <Td>
                      {canEdit && (
                        <button onClick={() => onQualite(r)} className="text-gold hover:underline text-xs font-semibold">Qualite</button>
                      )}
                    </Td>
                  )}
                  <Td>
                    <div className="flex gap-2 items-center justify-end">
                      <button
                        onClick={() => toggleExpand(r.id)}
                        className="text-ink/40 hover:text-ink text-xs border border-black/10 rounded px-1.5 py-0.5"
                        title="Voir tous les details"
                      >
                        {isOpen ? '▾' : '▸'} Details
                      </button>
                      {canEdit && trashMode && (
                        <button onClick={() => onRestore && onRestore(r.id)} className="text-forest hover:underline text-xs font-semibold">↩</button>
                      )}
                      {canEdit && !trashMode && (
                        <>
                          <button onClick={() => onEdit(r)} className="text-forest hover:underline text-xs">Modifier</button>
                          <button onClick={() => onDelete(r.id)} className="text-statut-annule hover:underline text-xs">Suppr.</button>
                        </>
                      )}
                    </div>
                  </Td>
                </tr>
                {isOpen && (
                  <tr className="border-t border-black/5 bg-forest-light/10">
                    <td colSpan={colCount + 1} className="px-4 py-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-x-4 gap-y-2 text-xs">
                        <DetailField label="Responsable" value={r.client} />
                        <DetailField label="Fonction" value={r.fonction_responsable} />
                        <DetailField label="Adresse" value={r.adresse} />
                        <DetailField label="Departement" value={r.departement} />
                        <DetailField label="Code postal" value={r.code_postal} />
                        <DetailField label="Telephone" value={r.telephone} />
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-ink/40 font-semibold">{label}</div>
      <div className="text-ink/80">{value || '—'}</div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">{children}</th>;
}
function Td({ children, className = '', title }: { children?: React.ReactNode; className?: string; title?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`} title={title}>{children}</td>;
}
