'use client';

import { useState } from 'react';
import { AccordPrincipe } from '@/lib/types';
import { colorForName } from '@/lib/palette';
import StatusTimeline from './status-timeline';

interface Props {
  item: AccordPrincipe;
  statutsAp: string[];
  statutsApRappel: string[];
  canEdit: boolean;
  onChanged: (patch: Partial<AccordPrincipe>) => void;
}

export default function ApPanel({ item, statutsAp, statutsApRappel, canEdit, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [commentaire, setCommentaire] = useState(item.relanceur_commentaire || '');
  const [pendingComment, setPendingComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingStatut, setPendingStatut] = useState<string | null>(null);
  const [pendingDate, setPendingDate] = useState('');
  const [error, setError] = useState('');

  const color = item.statut ? colorForName(item.statut, statutsAp) : null;

  async function patch(body: Record<string, any>) {
    return fetch(`/api/accords-principe/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function changeStatut(s: string) {
    setError('');
    setPendingStatut(s);
    setPendingComment('');
    setPendingDate(item.date_prochain_rappel ? String(item.date_prochain_rappel).slice(0, 10) : '');
  }

  async function confirmPendingStatut() {
    const needsDate = pendingStatut !== null && statutsApRappel.includes(pendingStatut);
    if (needsDate && !pendingDate) {
      setError('Nouvelle date obligatoire pour ce statut.');
      return;
    }
    const body: Record<string, any> = { statut: pendingStatut };
    if (needsDate) body.date_prochain_rappel = pendingDate;
    if (pendingComment.trim()) body.relanceur_commentaire = pendingComment.trim();
    const res = await patch(body);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || 'Erreur.');
      return;
    }
    onChanged({
      statut: pendingStatut!,
      ...(needsDate ? { date_prochain_rappel: pendingDate } : {}),
      ...(pendingComment.trim() ? { relanceur_commentaire: pendingComment.trim() } : {}),
    });
    if (pendingComment.trim()) setCommentaire(pendingComment.trim());
    setPendingStatut(null);
    setError('');
  }

  async function saveCommentaire() {
    setSaving(true);
    onChanged({ relanceur_commentaire: commentaire });
    await patch({ relanceur_commentaire: commentaire });
    setSaving(false);
    setOpen(false);
  }

  const rappelDue = !!item.date_prochain_rappel && item.statut && statutsApRappel.includes(item.statut);

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        {canEdit ? (
          <select
            value={pendingStatut ?? (item.statut || '')}
            onChange={(e) => changeStatut(e.target.value)}
            className="text-xs border rounded px-1.5 py-1"
            style={color ? { borderColor: color, color, fontWeight: 600 } : undefined}
          >
            <option value="">-- statut --</option>
            {statutsAp.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={color ? { backgroundColor: color + '22', color } : { color: '#999' }}
          >
            {item.statut || '—'}
          </span>
        )}
        {rappelDue && (
          <span className="text-xs text-gold font-medium">
            📅 {new Date(item.date_prochain_rappel!).toLocaleDateString('fr-FR')}
          </span>
        )}
        <button onClick={() => setOpen((o) => !o)} className="text-xs text-forest underline">
          {open ? 'Fermer' : 'Commentaire / historique'}
        </button>
      </div>

      {pendingStatut && (
        <div className="mt-2 bg-gold-light rounded-md p-2 space-y-1.5 max-w-xs">
          <div className="text-xs font-medium">Nouveau statut : {pendingStatut}</div>
          {statutsApRappel.includes(pendingStatut) && (
            <div>
              <label className="text-xs text-ink/60">Nouvelle date de rappel (obligatoire)</label>
              <input type="date" value={pendingDate} onChange={(e) => setPendingDate(e.target.value)} className="w-full text-xs border rounded px-1.5 py-1" />
            </div>
          )}
          <textarea
            value={pendingComment}
            onChange={(e) => setPendingComment(e.target.value)}
            placeholder="Commentaire du relanceur..."
            rows={2}
            className="w-full text-xs border rounded px-2 py-1"
          />
          <div className="flex gap-3">
            <button onClick={confirmPendingStatut} className="text-forest text-xs font-semibold hover:underline">Valider</button>
            <button onClick={() => { setPendingStatut(null); setError(''); }} className="text-ink/40 text-xs hover:underline">Annuler</button>
          </div>
        </div>
      )}
      {error && <p className="text-statut-annule text-xs mt-1">{error}</p>}

      {open && (
        <div className="mt-2 bg-forest-light/40 rounded-md p-3 max-w-md">
          <p className="text-xs text-ink/60 mb-2"><strong>Commentaire de l'agent :</strong> {item.commentaire || '—'}</p>
          <StatusTimeline entityType="ap" entityId={item.id} />
          <label className="text-xs font-semibold text-ink/60">Commentaire du relanceur</label>
          {canEdit ? (
            <>
              <textarea
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                rows={2}
                className="w-full text-xs border rounded px-2 py-1 mb-2"
              />
              <button
                onClick={saveCommentaire}
                disabled={saving}
                className="bg-forest hover:bg-forest-dark text-white text-xs font-medium px-3 py-1 rounded disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </>
          ) : (
            <p className="text-xs text-ink/70">{item.relanceur_commentaire || 'Aucun commentaire.'}</p>
          )}
        </div>
      )}
    </div>
  );
}
