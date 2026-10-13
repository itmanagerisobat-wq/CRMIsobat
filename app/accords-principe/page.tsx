'use client';

import { useEffect, useState } from 'react';
import { AccordPrincipe } from '@/lib/types';
import { colorForName } from '@/lib/palette';
import BookRdvModal from './book-rdv-modal';

const EMPTY_FORM = {
  raison_sociale: '', client: '', telephone: '', adresse: '', operation: '', statut: '', commentaire: '', date_prochain_rappel: '',
};

export default function AccordsPrincipePage() {
  const [items, setItems] = useState<AccordPrincipe[]>([]);
  const [statutsAp, setStatutsAp] = useState<string[]>([]);
  const [statutsApRappel, setStatutsApRappel] = useState<string[]>([]);
  const [operationsList, setOperationsList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ statut: string; commentaire: string; date_prochain_rappel: string }>({ statut: '', commentaire: '', date_prochain_rappel: '' });
  const [bookingItem, setBookingItem] = useState<AccordPrincipe | null>(null);

  async function load() {
    setLoading(true);
    const [paramsRes, apRes] = await Promise.all([
      fetch('/api/parametres', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/accords-principe', { cache: 'no-store' }).then((r) => r.json()),
    ]);
    setStatutsAp(paramsRes.data?.statuts_ap || []);
    setStatutsApRappel(paramsRes.data?.statuts_ap_rappel || []);
    const closed: string[] = paramsRes.data?.operations_fermees || [];
    setOperationsList((paramsRes.data?.operations || []).filter((o: string) => !closed.includes(o)));
    setItems(apRes.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const rappelRequired = statutsApRappel.includes(form.statut);

  async function submit() {
    if (!form.raison_sociale.trim() && !form.client.trim()) {
      setError('Indique au moins la raison sociale ou le responsable.');
      return;
    }
    if (rappelRequired && !form.date_prochain_rappel) {
      setError('Ce statut necessite une date de prochain rappel.');
      return;
    }
    setSaving(true);
    setError('');
    const res = await fetch('/api/accords-principe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(json.error || 'Erreur lors de l\'enregistrement.');
      return;
    }
    setForm({ ...EMPTY_FORM });
    setShowForm(false);
    load();
  }

  function startEdit(item: AccordPrincipe) {
    setEditingId(item.id);
    setEditDraft({ statut: item.statut || '', commentaire: item.commentaire || '', date_prochain_rappel: item.date_prochain_rappel || '' });
    setError('');
  }

  async function saveEdit(id: string) {
    if (statutsApRappel.includes(editDraft.statut) && !editDraft.date_prochain_rappel) {
      setError('Ce statut necessite une date de prochain rappel.');
      return;
    }
    const res = await fetch(`/api/accords-principe/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editDraft),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || 'Erreur lors de l\'enregistrement.');
      return;
    }
    setError('');
    setEditingId(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Supprimer cet accord de principe ?')) return;
    await fetch(`/api/accords-principe/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-ink">Accords de principe</h1>
      </div>
      <p className="text-ink/60 text-sm mb-6">
        Note ici les clients qui t'ont donne un accord de principe pendant ta prospection.
        Si l'accord se transforme en RDV, clique "Envoyer en RDV" directement depuis la ligne --
        pas besoin de retourner sur "Prise de RDV" ni de ressaisir les infos du client. La
        demande suit ensuite le circuit habituel (validation par le gestionnaire), puis apparait
        automatiquement dans la Relance une fois confirmee.
      </p>

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="bg-forest hover:bg-forest-dark text-white text-sm font-medium px-4 py-2 rounded-md mb-4"
        >
          + Nouvel accord de principe
        </button>
      )}

      {showForm && (
        <div className="bg-white rounded-lg border border-black/5 p-4 mb-6">
          <h2 className="text-sm font-semibold text-ink mb-3">Nouvel accord de principe</h2>
          <div className="grid sm:grid-cols-2 gap-2 mb-2">
            <input
              value={form.raison_sociale}
              onChange={(e) => setForm((f) => ({ ...f, raison_sociale: e.target.value }))}
              placeholder="Raison sociale"
              className="border border-black/10 rounded-md px-3 py-2 text-sm"
            />
            <input
              value={form.client}
              onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))}
              placeholder="Responsable"
              className="border border-black/10 rounded-md px-3 py-2 text-sm"
            />
            <input
              value={form.telephone}
              onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))}
              placeholder="Telephone"
              className="border border-black/10 rounded-md px-3 py-2 text-sm"
            />
            <input
              value={form.adresse}
              onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))}
              placeholder="Adresse"
              className="border border-black/10 rounded-md px-3 py-2 text-sm"
            />
            <select
              value={form.operation}
              onChange={(e) => setForm((f) => ({ ...f, operation: e.target.value }))}
              className="border border-black/10 rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="">Operation —</option>
              {operationsList.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select
              value={form.statut}
              onChange={(e) => setForm((f) => ({ ...f, statut: e.target.value }))}
              className="border border-black/10 rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="">Statut —</option>
              {statutsAp.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {rappelRequired && (
              <div>
                <label className="block text-xs font-medium text-gold mb-0.5">Date de prochain rappel (obligatoire)</label>
                <input
                  type="date"
                  value={form.date_prochain_rappel}
                  onChange={(e) => setForm((f) => ({ ...f, date_prochain_rappel: e.target.value }))}
                  className="w-full border border-gold/50 rounded-md px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>
          <textarea
            value={form.commentaire}
            onChange={(e) => setForm((f) => ({ ...f, commentaire: e.target.value }))}
            placeholder="Commentaire..."
            rows={2}
            className="w-full border border-black/10 rounded-md px-3 py-2 text-sm mb-2"
          />
          {error && <p className="text-statut-annule text-xs mb-2">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={saving}
              className="bg-forest hover:bg-forest-dark text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); setError(''); }}
              disabled={saving}
              className="bg-white border border-black/10 text-ink text-sm font-medium px-4 py-2 rounded-md"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {error && !showForm && (
        <p className="text-statut-annule text-xs mb-2">{error}</p>
      )}

      <div className="bg-white rounded-lg border border-black/5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-forest-light text-forest-dark text-left">
              <Th>Raison sociale</Th><Th>Responsable</Th><Th>Telephone</Th>
              <Th>Operation</Th><Th>Statut</Th><Th>Prochain rappel</Th><Th>Commentaire</Th><Th /></tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="text-center py-8 text-ink/40">Chargement...</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-ink/40">Aucun accord de principe pour le moment.</td></tr>
            )}
            {items.map((item) => {
              const editing = editingId === item.id;
              const color = item.statut ? colorForName(item.statut, statutsAp) : null;
              return (
                <tr key={item.id} className="border-t border-black/5 align-top">
                  <Td>{item.raison_sociale || '—'}</Td>
                  <Td>{item.client || '—'}</Td>
                  <Td>{item.telephone || '—'}</Td>
                  <Td>{item.operation || '—'}</Td>
                  <Td>
                    {editing ? (
                      <select
                        value={editDraft.statut}
                        onChange={(e) => setEditDraft((d) => ({ ...d, statut: e.target.value }))}
                        className="text-xs border rounded px-1.5 py-1"
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
                  </Td>
                  <Td>
                    {editing ? (
                      statutsApRappel.includes(editDraft.statut) && (
                        <input
                          type="date"
                          value={editDraft.date_prochain_rappel}
                          onChange={(e) => setEditDraft((d) => ({ ...d, date_prochain_rappel: e.target.value }))}
                          className="text-xs border rounded px-1.5 py-1"
                        />
                      )
                    ) : (
                      <span className={item.date_prochain_rappel ? 'text-gold font-medium' : 'text-ink/30'}>
                        {item.date_prochain_rappel ? new Date(item.date_prochain_rappel).toLocaleDateString('fr-FR') : '—'}
                      </span>
                    )}
                  </Td>
                  <Td>
                    {editing ? (
                      <textarea
                        value={editDraft.commentaire}
                        onChange={(e) => setEditDraft((d) => ({ ...d, commentaire: e.target.value }))}
                        rows={2}
                        className="text-xs border rounded px-2 py-1 w-48"
                      />
                    ) : (
                      <span className="text-ink/70">{item.commentaire || '—'}</span>
                    )}
                  </Td>
                  <Td>
                    {editing ? (
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(item.id)} className="text-forest text-xs font-medium hover:underline">Enregistrer</button>
                        <button onClick={() => setEditingId(null)} className="text-ink/40 text-xs hover:underline">Annuler</button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 items-start">
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(item)} className="text-forest text-xs hover:underline">Modifier</button>
                          <button onClick={() => remove(item.id)} className="text-statut-annule text-xs hover:underline">Suppr.</button>
                        </div>
                        {item.rdv_envoye_at ? (
                          <span className="text-xs text-statut-honore font-medium">
                            ✓ RDV envoye le {new Date(item.rdv_envoye_at).toLocaleDateString('fr-FR')}
                          </span>
                        ) : (
                          <button
                            onClick={() => setBookingItem(item)}
                            className="text-xs text-gold font-semibold hover:underline"
                          >
                            📅 Envoyer en RDV
                          </button>
                        )}
                      </div>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {bookingItem && (
        <BookRdvModal
          item={bookingItem}
          onClose={() => setBookingItem(null)}
          onBooked={() => {
            setBookingItem(null);
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
  return <td className="px-3 py-2">{children}</td>;
}
