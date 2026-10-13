'use client';

import { useEffect, useState } from 'react';
import { Rdv, RelanceLogEntry } from '@/lib/types';
import { colorForName } from '@/lib/palette';
import { isRappelStatut } from '@/lib/relance-statut';
import StatusTimeline from './status-timeline';

interface Props {
  rdv: Rdv;
  statutsRelance: string[];
  relanceurs: string[];
  canEdit: boolean;
  onStatutChanged: (patch: Partial<Rdv>) => void;
}

export default function RelancePanel({ rdv, statutsRelance, relanceurs, canEdit, onStatutChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<RelanceLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [agent, setAgent] = useState('');
  const [comment, setComment] = useState('');
  const [nextContact, setNextContact] = useState('');
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [pComment, setPComment] = useState('');
  const [pDate, setPDate] = useState('');
  const [pError, setPError] = useState('');

  async function loadLogs() {
    setLoading(true);
    const res = await fetch(`/api/relance-log?rdv_id=${rdv.id}`, { cache: 'no-store' });
    const json = await res.json();
    setLogs(json.data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (open) loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function addLog() {
    if (!comment.trim()) return;
    setSaving(true);
    await fetch('/api/relance-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rdv_id: rdv.id, agent: agent || null, commentaire: comment,
        date_prochain_contact: nextContact || null,
      }),
    });
    setComment('');
    setNextContact('');
    setSaving(false);
    loadLogs();
  }

  function startChange(s: string) {
    setPending(s);
    setPComment('');
    setPDate(rdv.relance_date_rappel ? String(rdv.relance_date_rappel).slice(0, 10) : '');
    setPError('');
  }

  async function confirmChange() {
    if (pending === null) return;
    if (isRappelStatut(pending) && !pDate) { setPError('Date de prochain rappel obligatoire.'); return; }
    setSaving(true);
    const res = await fetch(`/api/rdv/relance/${rdv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut_relance: pending, commentaire: pComment, date_rappel: isRappelStatut(pending) ? pDate : null }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setPError(j.error || 'Erreur.');
      return;
    }
    onStatutChanged({
      statut_relance: pending || null,
      relance_commentaire: pComment || null,
      relance_date_rappel: isRappelStatut(pending) ? pDate : null,
    });
    setPending(null);
    if (open) loadLogs();
  }

  const visiteLabel = rdv.statut
    ? `Visite : ${rdv.statut}${rdv.sous_statut ? ' - ' + rdv.sous_statut : ''}${rdv.motif ? ' (' + rdv.motif + ')' : ''}`
    : 'Visite : en attente de retour';

  const color = rdv.statut_relance ? colorForName(rdv.statut_relance, statutsRelance) : null;

  return (
    <div>
      <div className="flex items-center gap-2">
        {canEdit ? (
          <select
            value={pending ?? (rdv.statut_relance || '')}
            onChange={(e) => startChange(e.target.value)}
            className="text-xs border rounded px-1.5 py-1"
            style={color ? { borderColor: color, color, fontWeight: 600 } : undefined}
          >
            <option value="">-- statut relance --</option>
            {statutsRelance.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={color ? { backgroundColor: color + '22', color } : { color: '#999' }}
          >
            {rdv.statut_relance || '—'}
          </span>
        )}
        {rdv.relance_date_rappel && isRappelStatut(rdv.statut_relance) && (
          <span className="text-xs text-gold font-medium">📅 {new Date(rdv.relance_date_rappel).toLocaleDateString('fr-FR')}</span>
        )}
        <button onClick={() => setOpen((o) => !o)} className="text-xs text-forest underline">
          {open ? 'Fermer' : 'Historique'}
        </button>
      </div>

      {pending !== null && (
        <div className="mt-2 bg-gold-light rounded-md p-2 space-y-1.5 max-w-xs">
          <div className="text-xs font-medium">Nouveau statut : {pending || '—'}</div>
          {isRappelStatut(pending) && (
            <div>
              <label className="text-xs text-ink/60">Date du prochain rappel (obligatoire)</label>
              <input type="date" value={pDate} onChange={(e) => setPDate(e.target.value)} className="w-full text-xs border rounded px-2 py-1" />
            </div>
          )}
          <textarea
            value={pComment}
            onChange={(e) => setPComment(e.target.value)}
            placeholder="Commentaire..."
            rows={2}
            className="w-full text-xs border rounded px-2 py-1"
          />
          {pError && <p className="text-statut-annule text-xs">{pError}</p>}
          <div className="flex gap-3">
            <button onClick={confirmChange} disabled={saving} className="text-forest text-xs font-semibold hover:underline disabled:opacity-50">
              {saving ? '...' : 'Valider'}
            </button>
            <button onClick={() => setPending(null)} className="text-ink/40 text-xs hover:underline">Annuler</button>
          </div>
        </div>
      )}

      {open && (
        <div className="mt-2 bg-forest-light/40 rounded-md p-3 max-w-md">
          <StatusTimeline entityType="rdv" entityId={rdv.id} />
          <div className="text-xs font-semibold text-ink/60 mb-1">Appels / commentaires</div>
          {loading && <p className="text-xs text-ink/40">Chargement...</p>}
          <ul className="space-y-1.5 mb-3 max-h-48 overflow-y-auto">
            <li className="text-xs bg-white rounded px-2 py-1.5 border border-black/5">
              <span className="font-medium">{visiteLabel}</span>
            </li>
            {logs.map((l) => (
              <li key={l.id} className="text-xs bg-white rounded px-2 py-1.5 border border-black/5">
                <div className="flex justify-between text-ink/50 mb-0.5">
                  <span>{l.agent || 'Agent non precise'}</span>
                  <span>{new Date(l.created_at).toLocaleString('fr-FR')}</span>
                </div>
                <div>{l.commentaire}</div>
                {(l as any).date_prochain_contact && (
                  <div className="text-gold mt-0.5">
                    📅 Prochain contact : {new Date((l as any).date_prochain_contact).toLocaleDateString('fr-FR')}
                  </div>
                )}
              </li>
            ))}
            {!loading && logs.length === 0 && (
              <li className="text-xs text-ink/40 italic">Aucun appel enregistre.</li>
            )}
          </ul>

          {canEdit && (
            <div className="space-y-1.5">
              <select
                value={agent}
                onChange={(e) => setAgent(e.target.value)}
                className="w-full text-xs border rounded px-2 py-1"
              >
                <option value="">Agent...</option>
                {relanceurs.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Commentaire de l'appel..."
                rows={2}
                className="w-full text-xs border rounded px-2 py-1"
              />
              <div>
                <label className="text-xs text-ink/50">Prochain contact prevu (optionnel)</label>
                <input
                  type="date"
                  value={nextContact}
                  onChange={(e) => setNextContact(e.target.value)}
                  className="w-full text-xs border rounded px-2 py-1"
                />
              </div>
              <button
                onClick={addLog}
                disabled={saving || !comment.trim()}
                className="bg-forest hover:bg-forest-dark text-white text-xs font-medium px-3 py-1 rounded disabled:opacity-50"
              >
                {saving ? 'Ajout...' : '+ Ajouter un suivi'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
