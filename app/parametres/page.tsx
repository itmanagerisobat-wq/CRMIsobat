'use client';

import { useEffect, useState } from 'react';
import { useRole } from '@/lib/use-role';
import UtilisateursSection from './utilisateurs-section';
import AgentPinsSection from './agent-pins-section';
import AgentSummarySection from './agent-summary-section';
import QualiteCriteresSection from './qualite-criteres-section';
import CommercialZonesSection from './commercial-zones-section';
import CouleursImportSection from './couleurs-import-section';
import SousStatutCouleursSection from './sous-statut-couleurs-section';

const LISTS: { key: string; label: string }[] = [
  { key: 'operations', label: 'Operations' },
  { key: 'operations_fermees', label: 'Operations fermees (retirees des menus de creation -- retire une valeur d\'ici pour la reactiver)' },
  { key: 'commerciaux', label: 'Commerciaux (B2B)' },
  { key: 'commerciaux_b2c', label: 'Commerciaux (B2C)' },
  { key: 'relanceurs', label: 'Relanceurs (agents de suivi)' },
  { key: 'prestataires', label: 'Prestataires' },
  { key: 'departements', label: 'Departements' },
  { key: 'heures', label: 'Heures' },
  { key: 'motifs', label: 'Motifs (report/annulation)' },
  { key: 'sous_statuts', label: 'Sous-statuts (si Honore)' },
  { key: 'relance', label: 'Statuts a relancer' },
  { key: 'statuts_relance', label: 'Statuts de suivi relance (couleur selon ordre)' },
  { key: 'statuts_ap', label: 'Statuts des accords de principe (couleur selon ordre)' },
  { key: 'statuts_ap_rappel', label: 'Statuts AP necessitant une date de rappel obligatoire (parmi la liste ci-dessus)' },
  { key: 'statuts_confirmation_b2c', label: 'B2C - Statuts de confirmation du RDV (Confirme = envoie le RDV dans le Planning)' },
  { key: 'preconisations_b2c', label: 'B2C - Preconisations (fiche agent)' },
  { key: 'statuts_papiers', label: 'B2C - Statuts des papiers (Recuperation des papiers) -- le 1er = statut de depart' },
  { key: 'statuts_papiers_ok', label: 'B2C - Statuts des papiers POSITIFS : le dossier part en Installation et sort de la Relance (parmi la liste ci-dessus, ex : Recus)' },
  { key: 'visite_vers_papiers', label: 'B2C - Resultats de visite (statut ou sous-statut) qui envoient le dossier en Recuperation des papiers (ex : Devis signe)' },
  { key: 'statuts_installation', label: 'B2C - Statuts d\'installation' },
  { key: 'criteres_carte', label: 'Criteres pour la carte de France' },
  { key: 'temps_trajet_max', label: 'Seuil de proximite pour vert/orange (minutes) - Prise de RDV' },
  { key: 'heure_debut_journee', label: 'Heure de debut de journee - Prise de RDV' },
  { key: 'heure_fin_journee', label: 'Heure de fin de journee - Prise de RDV' },
  { key: 'duree_visite_minutes', label: 'Duree moyenne d\'une visite (minutes) - Disponibilites' },
  { key: 'max_rdv_par_jour', label: 'Nombre maximum de RDV par commercial et par jour - Disponibilites' },
  { key: 'seuil_alerte_phase_heures', label: 'Seuil d\'alerte si un dossier stagne (heures) - Planning' },
  { key: 'resultat_qualite', label: 'Resultats possibles a la phase Qualite' },
  { key: 'statuts_rdv_non_conforme', label: 'Resultats qualite consideres "non conforme" (parmi la liste ci-dessus)' },
  { key: 'statuts_visite', label: 'Statuts possibles a la phase Visite (les 5 statuts de base sont utilises par le systeme, ne les supprime pas -- tu peux en ajouter d\'autres)' },
  { key: 'statuts_import_couleur', label: 'Statuts possibles pour la correspondance couleurs -> statuts (import Excel)' },
  { key: 'documents_statuts', label: 'Statuts documents (Relance/Planning)' },
  { key: 'champs_prise_rdv_agent', label: 'Champs a remplir par l\'agent avant d\'envoyer une demande de RDV' },
  { key: 'champs_site', label: 'Champs "Informations de site" (Fiche client)' },
  { key: 'stats_affichees', label: 'Statuts affiches en cartes (Statistiques)' },
];

type Status = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export default function ParametresPage() {
  const role = useRole();
  const isAdmin = role === 'admin';
  const [tab, setTab] = useState('listes');
  // `saved` = last known server state. `draft` = what's shown/edited on screen.
  const [saved, setSaved] = useState<Record<string, string[]>>({});
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [errorMsg, setErrorMsg] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const res = await fetch('/api/parametres', { cache: 'no-store' });
    const json = await res.json();
    setSaved(json.data || {});
    setDraft(json.data || {});
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function addValue(key: string) {
    const v = (newValue[key] || '').trim();
    if (!v) return;
    setDraft((d) => ({ ...d, [key]: [...(d[key] || []), v] }));
    setNewValue((n) => ({ ...n, [key]: '' }));
    setStatus((s) => ({ ...s, [key]: 'dirty' }));
  }

  function removeValue(key: string, idx: number) {
    setDraft((d) => ({ ...d, [key]: (d[key] || []).filter((_, i) => i !== idx) }));
    setStatus((s) => ({ ...s, [key]: 'dirty' }));
  }

  function cancel(key: string) {
    setDraft((d) => ({ ...d, [key]: saved[key] || [] }));
    setStatus((s) => ({ ...s, [key]: 'idle' }));
  }

  async function save(key: string) {
    setStatus((s) => ({ ...s, [key]: 'saving' }));
    try {
      const res = await fetch('/api/parametres', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, values: draft[key] || [] }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus((s) => ({ ...s, [key]: 'error' }));
        setErrorMsg((e) => ({ ...e, [key]: json.error || res.statusText || 'Erreur inconnue' }));
        return;
      }
      setSaved((sv) => ({ ...sv, [key]: draft[key] }));
      setStatus((s) => ({ ...s, [key]: 'saved' }));
      setTimeout(() => setStatus((s) => (s[key] === 'saved' ? { ...s, [key]: 'idle' } : s)), 2000);
    } catch (e: any) {
      setStatus((s) => ({ ...s, [key]: 'error' }));
      setErrorMsg((em) => ({ ...em, [key]: e?.message || 'Erreur reseau' }));
    }
  }

  if (loading) return <p className="text-ink/40">Chargement...</p>;

  const TABS: { key: string; label: string; adminOnly?: boolean }[] = [
    { key: 'listes', label: 'Listes' },
    { key: 'utilisateurs', label: '👤 Utilisateurs', adminOnly: true },
    { key: 'agents', label: 'Agents de prospection', adminOnly: true },
    { key: 'qualite', label: 'Qualite RDV' },
    { key: 'zones', label: 'Zones commerciales' },
    { key: 'import', label: 'Import Excel' },
    { key: 'couleurs', label: 'Couleurs de ligne' },
    { key: 'resume', label: 'Resume agents' },
  ];
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);
  const current = visibleTabs.some((t) => t.key === tab) ? tab : 'listes';

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-1">Parametres</h1>
      <div className="flex flex-wrap gap-2 mb-6 mt-3">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${current === t.key ? 'bg-forest text-white border-forest' : 'bg-white text-ink border-black/10 hover:bg-forest-light'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {current === 'listes' && (
      <>
      <p className="text-ink/60 text-sm mb-6">
        Ces listes alimentent les menus deroulants du planning. Ajoute ou retire une valeur puis
        clique <strong>Enregistrer</strong> pour valider (rien n'est sauvegarde tant que tu n'as
        pas clique).
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        {LISTS.map(({ key, label }) => {
          const list = draft[key] || [];
          const st = status[key] || 'idle';
          return (
            <div key={key} className="bg-white rounded-lg border border-black/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-ink">{label}</h2>
                <StatusBadge status={st} />
              </div>
              <ul className="space-y-1 mb-3">
                {list.map((v, idx) => (
                  <li key={idx} className="flex items-center justify-between text-sm bg-forest-light/60 rounded px-2 py-1">
                    <span>{v}</span>
                    <button onClick={() => removeValue(key, idx)} className="text-statut-annule/70 hover:text-statut-annule text-xs">
                      Retirer
                    </button>
                  </li>
                ))}
                {list.length === 0 && (
                  <li className="text-ink/30 text-sm italic">Aucune valeur</li>
                )}
              </ul>
              <div className="flex gap-2 mb-3">
                <input
                  value={newValue[key] || ''}
                  onChange={(e) => setNewValue((n) => ({ ...n, [key]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && addValue(key)}
                  placeholder="Nouvelle valeur..."
                  className="flex-1 border border-black/10 rounded-md px-3 py-1.5 text-sm"
                />
                <button
                  onClick={() => addValue(key)}
                  className="bg-white border border-black/10 text-ink text-sm font-medium px-3 rounded-md hover:bg-forest-light"
                >
                  Ajouter
                </button>
              </div>

              {st === 'error' && (
                <p className="text-xs text-statut-annule mb-2">Erreur : {errorMsg[key]}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => save(key)}
                  disabled={st === 'idle' || st === 'saving' || st === 'saved'}
                  className="flex-1 bg-forest hover:bg-forest-dark text-white text-sm font-medium py-1.5 rounded-md disabled:opacity-40"
                >
                  {st === 'saving' ? 'Enregistrement...' : st === 'saved' ? '\u2713 Enregistre' : 'Enregistrer'}
                </button>
                {st === 'dirty' && (
                  <button
                    onClick={() => cancel(key)}
                    className="px-3 text-sm text-ink/50 hover:text-ink"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      </>
      )}

      {current === 'qualite' && (
        <>
          <h2 className="text-xl font-bold text-ink mb-1">Qualite RDV</h2>
          <QualiteCriteresSection operations={saved.operations || []} />
        </>
      )}

      {current === 'zones' && (
        <>
          <h2 className="text-xl font-bold text-ink mb-1">Zones commerciales</h2>
          <CommercialZonesSection commerciaux={saved.commerciaux || []} />
        </>
      )}

      {current === 'import' && (
        <>
          <h2 className="text-xl font-bold text-ink mb-1">Import Excel</h2>
          <CouleursImportSection />
        </>
      )}

      {current === 'couleurs' && (
        <>
          <h2 className="text-xl font-bold text-ink mb-1">Couleurs de ligne (Planning)</h2>
          <SousStatutCouleursSection sousStatuts={saved.sous_statuts || []} />
        </>
      )}

      {isAdmin && current === 'utilisateurs' && (
        <>
          <h2 className="text-xl font-bold text-ink mb-1">Utilisateurs</h2>
          <p className="text-ink/60 text-sm mb-4">
            Comptes individuels de l'equipe. Les anciens mots de passe partages
            (Admin/Visualisation/Relanceur) continuent aussi de fonctionner en secours.
          </p>
          <UtilisateursSection />
        </>
      )}

      {isAdmin && current === 'agents' && (
        <>
          <h2 className="text-xl font-bold text-ink mb-1">Agents de prospection</h2>
          <AgentPinsSection />
        </>
      )}

      {current === 'resume' && (
        <div className="mt-4">
          <AgentSummarySection />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === 'dirty') return <span className="text-xs text-gold font-medium">Modifications non enregistrees</span>;
  if (status === 'saving') return <span className="text-xs text-ink/40">Enregistrement...</span>;
  if (status === 'saved') return <span className="text-xs text-statut-honore font-medium">\u2713 Enregistre</span>;
  if (status === 'error') return <span className="text-xs text-statut-annule font-medium">Erreur</span>;
  return null;
}
