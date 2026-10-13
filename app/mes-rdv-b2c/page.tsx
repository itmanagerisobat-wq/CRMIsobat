'use client';

import { useCallback, useEffect, useState } from 'react';
import { colorForName } from '@/lib/palette';
import FicheForm, { EMPTY_FICHE, FicheState, ficheToBody, rowToFiche } from './fiche-form';

interface Row {
  id: string; created_at: string; client: string | null; telephone: string | null; adresse: string | null;
  operation: string | null; date: string | null; heure: string | null;
  confirmation_statut: string | null; confirmation_commentaire: string | null; status: string; fiche: any; valide_at: string | null;
}

export default function MesRdvB2cPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [statuts, setStatuts] = useState<string[]>([]);
  const [preconisations, setPreconisations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FicheState>({ ...EMPTY_FICHE });
  const [editing, setEditing] = useState<Row | null>(null);
  const [dateDraft, setDateDraft] = useState({ date: '', heure: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [r, p] = await Promise.all([
      fetch('/api/b2c-rdv', { cache: 'no-store' }).then((x) => x.json()),
      fetch('/api/parametres', { cache: 'no-store' }).then((x) => x.json()),
    ]);
    setRows(r.data || []);
    setStatuts(p.data?.statuts_confirmation_b2c || []);
    setPreconisations(p.data?.preconisations_b2c || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  function openNew() { setEditing(null); setForm({ ...EMPTY_FICHE }); setDateDraft({ date: '', heure: '' }); setError(''); setShowForm(true); }
  function openEdit(r: Row) {
    setEditing(r); setForm(rowToFiche(r));
    setDateDraft({ date: r.date ? String(r.date).slice(0, 10) : '', heure: r.heure || '' });
    setError(''); setShowForm(true);
  }

  async function save() {
    setError('');
    if (!form.client.trim() || !form.telephone.trim()) { setError('Nom et prenom + telephone obligatoires.'); return; }
    setSaving(true);
    const body = { ...ficheToBody(form), date: dateDraft.date || null, heure: dateDraft.heure || null };
    const res = await fetch(editing ? `/api/b2c-rdv/${editing.id}` : '/api/b2c-rdv', {
      method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || 'Erreur'); return; }
    setShowForm(false);
    load();
  }

  async function remove(r: Row) {
    if (!confirm(`Supprimer le RDV de ${r.client || 'ce client'} ?`)) return;
    const res = await fetch(`/api/b2c-rdv/${r.id}`, { method: 'DELETE' });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || 'Erreur'); return; }
    load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold text-ink">Mes RDV (B2C)</h1>
        <button onClick={openNew} className="bg-forest hover:bg-forest-dark text-white text-sm font-medium px-4 py-2 rounded-md">+ Nouveau RDV</button>
      </div>
      <p className="text-ink/60 text-sm mb-4">
        Saisis la fiche du client. La date et l'heure du RDV sont fixees par la responsable : tu peux aussi les renseigner ici si elle te les a communiquees.
      </p>

      {showForm && (
        <div className="bg-white rounded-lg border border-black/10 p-4 mb-5">
          <h2 className="font-semibold text-ink mb-3">{editing ? 'Modifier le RDV' : 'Nouveau RDV'}</h2>
          <FicheForm value={form} onChange={setForm} preconisations={preconisations} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">Date du RDV (si communiquee)</label>
              <input type="date" value={dateDraft.date} onChange={(e) => setDateDraft((d) => ({ ...d, date: e.target.value }))} className="w-full border border-black/10 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">Heure</label>
              <input type="time" value={dateDraft.heure} onChange={(e) => setDateDraft((d) => ({ ...d, heure: e.target.value }))} className="w-full border border-black/10 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
          {error && <p className="text-xs text-statut-annule bg-statut-annule/5 rounded px-3 py-2 mt-3">{error}</p>}
          <div className="flex gap-3 mt-4">
            <button onClick={save} disabled={saving} className="bg-forest hover:bg-forest-dark text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-40">
              {saving ? 'Enregistrement...' : editing ? 'Enregistrer' : 'Envoyer a la responsable'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-ink/50 hover:underline">Annuler</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-black/5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-forest-light text-forest-dark text-left text-xs uppercase tracking-wide">
              <th className="px-3 py-2">Saisi le</th><th className="px-3 py-2">Client</th><th className="px-3 py-2">Telephone</th>
              <th className="px-3 py-2">Preconisation</th><th className="px-3 py-2">Date RDV</th><th className="px-3 py-2">Heure</th>
              <th className="px-3 py-2">Confirmation</th><th className="px-3 py-2">Commentaire</th><th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="text-center py-8 text-ink/40">Chargement...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-ink/40">Aucun RDV saisi pour le moment.</td></tr>}
            {rows.map((r) => {
              const st = r.valide_at ? (r.confirmation_statut || 'A confirmer') : 'Envoye';
              const color = r.valide_at ? colorForName(st, statuts) : '#6b7280';
              return (
                <tr key={r.id} className="border-t border-black/5 align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="px-3 py-2 font-medium">{r.client || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.telephone || '—'}</td>
                  <td className="px-3 py-2">{r.operation || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.date ? new Date(r.date).toLocaleDateString('fr-FR') : <span className="text-ink/40">a fixer</span>}</td>
                  <td className="px-3 py-2">{r.heure || '—'}</td>
                  <td className="px-3 py-2">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: color + '22', color }}>{st}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-ink/70 max-w-xs">{r.confirmation_commentaire || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => openEdit(r)} className="text-xs font-semibold text-forest hover:underline mr-3">Modifier</button>
                    {!r.valide_at && (
                      <button onClick={() => remove(r)} className="text-xs font-semibold text-statut-annule hover:underline">Supprimer</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
