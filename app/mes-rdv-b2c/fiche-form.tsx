'use client';

import { FICHE_OPTIONS } from '@/lib/b2c-flow';

export interface FicheState {
  client: string; telephone: string; adresse: string; code_postal: string;
  preconisation: string; residence: string; occupant: string; email: string; nb_personnes: string;
  revenu_fiscal: string; type_compteur: string; superficie: string; mode_chauffage: string;
  emplacement_chaudiere: string; type_radiateurs: string;
}

export const EMPTY_FICHE: FicheState = {
  client: '', telephone: '', adresse: '', code_postal: '', preconisation: '', residence: '', occupant: '', email: '', nb_personnes: '',
  revenu_fiscal: '', type_compteur: '', superficie: '', mode_chauffage: '', emplacement_chaudiere: '', type_radiateurs: '',
};

const inp = 'w-full border border-black/10 rounded-md px-3 py-2 text-sm bg-white';

export function ficheToBody(f: FicheState) {
  const { client, telephone, adresse, code_postal, ...fiche } = f;
  return { client, telephone, adresse, code_postal, fiche };
}

export function rowToFiche(r: any): FicheState {
  const fiche = (typeof r.fiche === 'string' ? JSON.parse(r.fiche) : r.fiche) || {};
  return { ...EMPTY_FICHE, ...fiche, client: r.client || '', telephone: r.telephone || '', adresse: r.adresse || '', code_postal: r.code_postal || '' };
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink/60 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inp}>
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink/60 mb-1">{label}</label>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inp} />
    </div>
  );
}

/** Fiche client B2C remplie par l'agent (preconisation PAC, logement, chauffage...). */
export default function FicheForm({ value, onChange, preconisations }: { value: FicheState; onChange: (f: FicheState) => void; preconisations: string[] }) {
  const set = (k: keyof FicheState) => (v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <Sel label="Preconisation" value={value.preconisation} onChange={set('preconisation')} options={preconisations} />
      <Sel label="Maison" value={value.residence} onChange={set('residence')} options={FICHE_OPTIONS.residence} />
      <Sel label="Proprietaire / locataire" value={value.occupant} onChange={set('occupant')} options={FICHE_OPTIONS.occupant} />
      <Field label="Nom et prenom *" value={value.client} onChange={set('client')} />
      <Field label="N° de telephone *" value={value.telephone} onChange={set('telephone')} type="tel" />
      <Field label="Email proprietaire" value={value.email} onChange={set('email')} type="email" />
      <div className="sm:col-span-2">
        <Field label="Adresse" value={value.adresse} onChange={set('adresse')} />
      </div>
      <Field label="Code postal" value={value.code_postal} onChange={set('code_postal')} placeholder="ex : 75011" />
      <Field label="Nbr de personnes sur le foyer fiscal" value={value.nb_personnes} onChange={set('nb_personnes')} type="number" />
      <Field label="Revenu fiscal de reference (€)" value={value.revenu_fiscal} onChange={set('revenu_fiscal')} type="number" />
      <Sel label="Type de compteur" value={value.type_compteur} onChange={set('type_compteur')} options={FICHE_OPTIONS.type_compteur} />
      <Field label="Superficie habitable (m²)" value={value.superficie} onChange={set('superficie')} type="number" />
      <Sel label="Mode de chauffage" value={value.mode_chauffage} onChange={set('mode_chauffage')} options={FICHE_OPTIONS.mode_chauffage} />
      <Field label="Emplacement de la chaudiere" value={value.emplacement_chaudiere} onChange={set('emplacement_chaudiere')} />
      <Sel label="Type des radiateurs" value={value.type_radiateurs} onChange={set('type_radiateurs')} options={FICHE_OPTIONS.type_radiateurs} />
    </div>
  );
}
