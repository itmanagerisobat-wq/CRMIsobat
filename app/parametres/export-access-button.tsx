'use client';

import { useState } from 'react';

export default function ExportAccessButton() {
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!confirm("Exporter les acces en Excel ?\n\nLes mots de passe sont stockes chiffres : l'export GENERE de nouveaux mots de passe pour tous les agents de prospection (les anciens ne marcheront plus et ils seront deconnectes).")) return;
    const includeTeam = confirm("Generer aussi de NOUVEAUX mots de passe pour les comptes de l'equipe (gestionnaires, relanceur, responsable, admins sauf toi) ?\n\nOK = oui (ils seront deconnectes)\nAnnuler = non, leurs mots de passe restent inchanges.");
    setBusy(true);
    const res = await fetch('/api/export-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ includeTeam }) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || 'Erreur.'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'acces-isobat.xlsx'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button onClick={run} disabled={busy} className="mb-4 bg-white border border-forest text-forest hover:bg-forest-light text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50">
      {busy ? 'Generation...' : '📥 Exporter tous les acces (Excel)'}
    </button>
  );
}
