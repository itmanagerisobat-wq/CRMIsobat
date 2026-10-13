'use client';

import { useEffect, useState } from 'react';
import { Rdv, CORE_STATUTS } from '@/lib/types';
import { computePhase, PHASE_LABELS } from '@/lib/pipeline';
import { textIncludes } from '@/lib/text-match';
import RdvHistory from './rdv-history';

interface Props {
  rdv: Rdv;
  params: Record<string, string[]>;
  onClose: () => void;
  onSaved: () => void;
  intakeOnly?: boolean;
  forceQualite?: boolean;
}

const inp = 'w-full border border-black/10 rounded-md px-3 py-2 text-sm';

export default function PhasePopup({ rdv, params, onClose, onSaved, intakeOnly = false, forceQualite = false }: Props) {
  const phase = forceQualite ? 'qualite' : computePhase(rdv);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showIntake, setShowIntake] = useState(intakeOnly);
  const [showHistory, setShowHistory] = useState(false);

  // intake (always editable, collapsed by default)
  const [intake, setIntake] = useState({
    date: rdv.date || '', heure: rdv.heure || '', operation: rdv.operation || '',
    raison_sociale: rdv.raison_sociale || '', client: rdv.client || '', telephone: rdv.telephone || '',
    fonction_responsable: rdv.fonction_responsable || '',
    departement: rdv.departement || '', code_postal: rdv.code_postal || '', adresse: rdv.adresse || '',
    prestataire: rdv.prestataire || '', agent_name: rdv.agent_name || '',
  });

  // qualite
  const [qualiteConfirmation, setQualiteConfirmation] = useState<boolean | null>(rdv.qualite_confirmation ?? null);
  const [qualiteCriteresRespectes, setQualiteCriteresRespectes] = useState<boolean | null>(rdv.qualite_criteres_respectes ?? null);
  const [qualiteResultat, setQualiteResultat] = useState(rdv.qualite_resultat || '');
  const [qualiteNouvelleDate, setQualiteNouvelleDate] = useState('');

  // auto-selects the positive outcome once both checks pass -- the
  // Gestionnaire can still override manually afterwards for edge cases
  // (client cancels, postpones, unreachable, etc.)
  useEffect(() => {
    if (qualiteConfirmation === true && qualiteCriteresRespectes === true) {
      const positive = (params.resultat_qualite || []).find((v) => textIncludes(v, 'confirme'));
      if (positive) setQualiteResultat(positive);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qualiteConfirmation, qualiteCriteresRespectes]);
  const [qualiteCommentaire, setQualiteCommentaire] = useState(rdv.qualite_commentaire || '');

  // affectation
  const [commercial, setCommercial] = useState(rdv.commercial || '');
  const [prestataire, setPrestataire] = useState(rdv.prestataire || '');
  const [conflict, setConflict] = useState<{ commercialConflict: Rdv | null; clientConflict: Rdv | null }>({ commercialConflict: null, clientConflict: null });
  const [forceConflict, setForceConflict] = useState(false);

  // visite
  const [statut, setStatut] = useState(rdv.statut || '');
  const [motif, setMotif] = useState(rdv.motif || '');
  // highlights the Date field above and requires it below when the agent
  // picks a "Reporte" statut from this general edit popup -- without this,
  // staff were leaving the old date in place and creating a brand-new RDV
  // for the rescheduled date instead, leaving a duplicate behind.
  const isReporteSelected = intakeOnly && phase !== 'qualite' && textIncludes(statut, 'reporte');

  // retour
  const [sousStatut, setSousStatut] = useState(rdv.sous_statut || '');
  const [compteRendu, setCompteRendu] = useState(rdv.compte_rendu || '');

  useEffect(() => {
    if (phase !== 'affectation') return;
    if (!rdv.date || !rdv.heure) return;
    const t = setTimeout(async () => {
      const qs = new URLSearchParams({ date: rdv.date!, heure: rdv.heure!, commercial, raison_sociale: intake.raison_sociale });
      qs.set('exclude_id', rdv.id);
      const res = await fetch(`/api/rdv/check-conflit?${qs.toString()}`);
      if (res.ok) setConflict(await res.json());
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, commercial]);

  const hasConflict = (conflict.commercialConflict || conflict.clientConflict) && !forceConflict;

  async function patch(extra: Record<string, any>) {
    setSaving(true);
    setError('');
    const res = await fetch(`/api/rdv/${rdv.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(extra),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || 'Erreur lors de la sauvegarde.');
      return false;
    }
    return true;
  }

  async function saveIntake() {
    if (isReporteSelected && intake.date === (rdv.date || '')) {
      setError('Statut "Reporte" : indique la nouvelle date dans le champ Date ci-dessus (sinon ce RDV garde son ancienne date et on risque un doublon).');
      return;
    }
    const payload: Record<string, any> = { ...intake };
    if (intakeOnly && phase !== 'qualite') payload.statut = statut;
    const ok = await patch(payload);
    if (ok) onSaved();
  }

  async function saveQualite() {
    const nonConformeList = params.statuts_rdv_non_conforme || [];
    const nonConforme = nonConformeList.includes(qualiteResultat);
    const isAnnule = textIncludes(qualiteResultat, 'annule');
    const isReporte = textIncludes(qualiteResultat, 'reporte');
    const payload: Record<string, any> = {
      qualite_confirmation: qualiteConfirmation,
      qualite_criteres_respectes: qualiteCriteresRespectes,
      qualite_resultat: qualiteResultat,
      qualite_commentaire: qualiteCommentaire,
      qualite_non_conforme: nonConforme,
      qualite_annule: isAnnule,
      qualite_dernier_appel: new Date().toISOString(),
    };
    if (isReporte && qualiteNouvelleDate) payload.date = qualiteNouvelleDate;
    const ok = await patch(payload);
    if (ok) onSaved();
  }

  async function saveAffectation() {
    if (hasConflict) return;
    const ok = await patch({ commercial, prestataire });
    if (ok) onSaved();
  }

  async function saveVisite() {
    const ok = await patch({ statut, motif });
    if (ok) onSaved();
  }

  async function saveRetour() {
    const ok = await patch({ sous_statut: sousStatut, compte_rendu: compteRendu });
    if (ok) onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg p-6 my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-ink text-lg">
            {intakeOnly ? 'Modifier le RDV' : phase === 'closed' ? 'Dossier cloture' : PHASE_LABELS[phase]}
          </h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-ink/50 mb-4">
          {intake.raison_sociale || intake.client || 'Client non precise'} · {intake.operation || '—'}
        </p>

        <div className="flex items-center gap-3 mb-3">
          {!intakeOnly && (
            <button onClick={() => setShowIntake((v) => !v)} className="text-xs text-forest underline">
              {showIntake ? 'Masquer' : 'Modifier'} les informations du RDV
            </button>
          )}
          <button onClick={() => setShowHistory((v) => !v)} className="text-xs text-ink/50 underline">
            {showHistory ? 'Masquer' : 'Voir'} l'historique
          </button>
          <a href={`/api/rdv/${rdv.id}/export-pdf`} className="text-xs text-forest underline">
            ↓ Exporter en PDF
          </a>
        </div>

        {showHistory && (
          <div className="mb-4">
            <RdvHistory rdvId={rdv.id} />
          </div>
        )}

        {showIntake && (
          <div className="grid sm:grid-cols-2 gap-2 mb-4 bg-forest-light/20 rounded-lg p-3">
            <div>
              <label className={`block text-xs font-medium mb-1 ${isReporteSelected ? 'text-gold' : 'text-ink/60'}`}>
                {isReporteSelected ? 'Nouvelle date (Reporte)' : 'Date du RDV'}
              </label>
              <input
                value={intake.date}
                type="date"
                onChange={(e) => setIntake((f) => ({ ...f, date: e.target.value }))}
                className={isReporteSelected ? `${inp} border-gold ring-1 ring-gold/40` : inp}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">Heure</label>
              <input
                type="text"
                value={intake.heure}
                onChange={(e) => setIntake((f) => ({ ...f, heure: e.target.value }))}
                placeholder="Heure (ex: 9h30)"
                className={inp}
              />
            </div>
            <select value={intake.operation} onChange={(e) => setIntake((f) => ({ ...f, operation: e.target.value }))} className={inp}>
              <option value="">Operation —</option>
              {(params.operations || []).filter((o) => !(params.operations_fermees || []).includes(o) || o === intake.operation).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select value={intake.prestataire} onChange={(e) => setIntake((f) => ({ ...f, prestataire: e.target.value }))} className={inp}>
              <option value="">Prestataire —</option>
              {(params.prestataires || []).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={intake.departement} onChange={(e) => setIntake((f) => ({ ...f, departement: e.target.value }))} className={inp}>
              <option value="">Departement —</option>
              {(params.departements || []).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <input value={intake.code_postal} placeholder="Code postal" onChange={(e) => setIntake((f) => ({ ...f, code_postal: e.target.value }))} className={inp} />
            <input value={intake.adresse} placeholder="Adresse" onChange={(e) => setIntake((f) => ({ ...f, adresse: e.target.value }))} className={inp} />
            <input value={intake.agent_name} placeholder="Agent de prospection" onChange={(e) => setIntake((f) => ({ ...f, agent_name: e.target.value }))} className={inp} />
            <input value={intake.raison_sociale} placeholder="Raison sociale" onChange={(e) => setIntake((f) => ({ ...f, raison_sociale: e.target.value }))} className={inp} />
            <input value={intake.client} placeholder="Responsable" onChange={(e) => setIntake((f) => ({ ...f, client: e.target.value }))} className={inp} />
            <input value={intake.fonction_responsable} placeholder="Fonction du responsable" onChange={(e) => setIntake((f) => ({ ...f, fonction_responsable: e.target.value }))} className={inp} />
            <input value={intake.telephone} placeholder="Telephone" onChange={(e) => setIntake((f) => ({ ...f, telephone: e.target.value }))} className={inp} />
            {intakeOnly && phase !== 'qualite' && (
              <select value={statut} onChange={(e) => setStatut(e.target.value)} className={`${inp} sm:col-span-2`}>
                <option value="">Statut —</option>
                {(params.statuts_visite && params.statuts_visite.length > 0 ? params.statuts_visite : CORE_STATUTS)
                  .filter((s) => s !== 'honore' || !!rdv.commercial)
                  .map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {isReporteSelected && (
              <p className="sm:col-span-2 text-[11px] text-gold -mt-1">
                ⚠️ N'oublie pas de mettre a jour le champ <strong>Date</strong> ci-dessus avec la nouvelle date
                du RDV -- sinon il reste a l'ancienne date et un doublon est souvent cree par erreur.
              </p>
            )}
            {error && <p className="sm:col-span-2 text-xs text-statut-annule bg-statut-annule/5 rounded px-3 py-2">{error}</p>}
            <button onClick={saveIntake} disabled={saving} className="sm:col-span-2 bg-forest text-white text-xs font-medium py-1.5 rounded disabled:opacity-50">
              Enregistrer les infos
            </button>
          </div>
        )}

        {!intakeOnly && phase === 'closed' && (
          <div className="text-sm text-ink/60">
            <p className="mb-2">Ce dossier est cloture{rdv.qualite_non_conforme ? ` (Qualite : ${rdv.qualite_resultat})` : rdv.statut === 'Annule' ? ' (Annule)' : ''}.</p>
            {rdv.qualite_commentaire && <p className="text-xs">Commentaire qualite : {rdv.qualite_commentaire}</p>}
          </div>
        )}

        {!intakeOnly && phase === 'qualite' && (
          <div>
            <div className="bg-forest-light/30 border border-forest/20 rounded-lg p-3 mb-3">
              <h3 className="text-xs font-semibold uppercase text-forest-dark mb-1.5">Confirmation RDV avec le client</h3>
              <div className="flex gap-2">
                <button onClick={() => setQualiteConfirmation(true)} className={`px-3 py-1.5 rounded-md text-xs font-medium border ${qualiteConfirmation === true ? 'bg-statut-honore text-white border-transparent' : 'bg-white border-black/10 text-ink/60'}`}>Oui</button>
                <button onClick={() => setQualiteConfirmation(false)} className={`px-3 py-1.5 rounded-md text-xs font-medium border ${qualiteConfirmation === false ? 'bg-statut-annule text-white border-transparent' : 'bg-white border-black/10 text-ink/60'}`}>Non</button>
              </div>
            </div>

            <div className="bg-forest-light/30 border border-forest/20 rounded-lg p-3 mb-3">
              <h3 className="text-xs font-semibold uppercase text-forest-dark mb-1.5">Criteres d'eligibilite respectes</h3>
              <p className="text-[11px] text-ink/50 mb-1.5">Verification interne (ex: a partir de l'enregistrement de l'appel).</p>
              <div className="flex gap-2">
                <button onClick={() => setQualiteCriteresRespectes(true)} className={`px-3 py-1.5 rounded-md text-xs font-medium border ${qualiteCriteresRespectes === true ? 'bg-statut-honore text-white border-transparent' : 'bg-white border-black/10 text-ink/60'}`}>Oui</button>
                <button onClick={() => setQualiteCriteresRespectes(false)} className={`px-3 py-1.5 rounded-md text-xs font-medium border ${qualiteCriteresRespectes === false ? 'bg-statut-annule text-white border-transparent' : 'bg-white border-black/10 text-ink/60'}`}>Non</button>
              </div>
            </div>

            <div className="bg-forest-light/30 border border-forest/20 rounded-lg p-3 mb-3">
              <h3 className="text-xs font-semibold uppercase text-forest-dark mb-1.5">Resultat final</h3>
              <select value={qualiteResultat} onChange={(e) => setQualiteResultat(e.target.value)} className={`${inp} mb-2`}>
                <option value="">—</option>
                {(params.resultat_qualite || []).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {textIncludes(qualiteResultat, 'reporte') && (
                <div className="mb-2">
                  <label className="block text-xs font-medium text-ink/60 mb-1">Nouvelle date demandee</label>
                  <input type="date" value={qualiteNouvelleDate} onChange={(e) => setQualiteNouvelleDate(e.target.value)} className={inp} />
                </div>
              )}
              <textarea value={qualiteCommentaire} onChange={(e) => setQualiteCommentaire(e.target.value)} rows={2} placeholder="Commentaire..." className={`${inp} resize-none`} />
            </div>
            {error && <p className="text-xs text-statut-annule bg-statut-annule/5 rounded px-3 py-2 mb-2">{error}</p>}
            <button onClick={saveQualite} disabled={saving || !qualiteResultat} className="bg-forest hover:bg-forest-dark text-white text-sm font-medium py-2 px-4 rounded-md disabled:opacity-40">
              {saving ? 'Enregistrement...' : 'Valider'}
            </button>
          </div>
        )}

        {!intakeOnly && phase === 'affectation' && (
          <div>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-ink/60 mb-1">Commercial</label>
                <select value={commercial} onChange={(e) => setCommercial(e.target.value)} className={inp}>
                  <option value="">—</option>
                  {(params.commerciaux || []).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink/60 mb-1">Prestataire</label>
                <select value={prestataire} onChange={(e) => setPrestataire(e.target.value)} className={inp}>
                  <option value="">—</option>
                  {(params.prestataires || []).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            {conflict.commercialConflict && (
              <div className="text-xs bg-statut-annule/10 text-statut-annule rounded px-3 py-2 mb-2 flex items-center justify-between flex-wrap gap-2">
                <span>⚠️ <strong>{commercial}</strong> a deja un RDV a {intake.heure} le {intake.date}.</span>
                <button onClick={() => setForceConflict(true)} className="bg-statut-annule text-white px-2 py-1 rounded font-medium">Confirmer quand meme</button>
              </div>
            )}
            {error && <p className="text-xs text-statut-annule bg-statut-annule/5 rounded px-3 py-2 mb-2">{error}</p>}
            <button onClick={saveAffectation} disabled={saving || !commercial || !!hasConflict} className="bg-forest hover:bg-forest-dark text-white text-sm font-medium py-2 px-4 rounded-md disabled:opacity-40">
              {saving ? 'Enregistrement...' : 'Confirmer l\'affectation'}
            </button>
          </div>
        )}

        {!intakeOnly && phase === 'visite' && (
          <div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-ink/60 mb-1">Statut</label>
              <select value={statut} onChange={(e) => setStatut(e.target.value)} className={inp}>
                <option value="">—</option>
                {(params.statuts_visite && params.statuts_visite.length > 0 ? params.statuts_visite : CORE_STATUTS).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-ink/60 mb-1">Commentaire</label>
              <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={2} className={`${inp} resize-none`} />
            </div>
            {error && <p className="text-xs text-statut-annule bg-statut-annule/5 rounded px-3 py-2 mb-2">{error}</p>}
            <button onClick={saveVisite} disabled={saving || !statut} className="bg-forest hover:bg-forest-dark text-white text-sm font-medium py-2 px-4 rounded-md disabled:opacity-40">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        )}

        {!intakeOnly && phase === 'retour' && (
          <div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-ink/60 mb-1">Sous-statut</label>
              <select value={sousStatut} onChange={(e) => setSousStatut(e.target.value)} className={inp}>
                <option value="">—</option>
                {(params.sous_statuts || []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-ink/60 mb-1">Compte-rendu / echange avec le client</label>
              <textarea value={compteRendu} onChange={(e) => setCompteRendu(e.target.value)} rows={3} className={`${inp} resize-none`} />
            </div>
            {error && <p className="text-xs text-statut-annule bg-statut-annule/5 rounded px-3 py-2 mb-2">{error}</p>}
            <button onClick={saveRetour} disabled={saving} className="bg-forest hover:bg-forest-dark text-white text-sm font-medium py-2 px-4 rounded-md disabled:opacity-40">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
