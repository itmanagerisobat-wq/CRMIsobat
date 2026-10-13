import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACTION_LABELS: Record<string, string> = {
  create_rdv: 'RDV cree',
  update_rdv: 'RDV modifie',
  delete_rdv: 'RDV supprime',
  restore_backup: 'Sauvegarde restauree',
};

function line(doc: PDFKit.PDFDocument, label: string, value: string | null | undefined) {
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#333').text(label, { continued: true });
  doc.font('Helvetica').fillColor('#111').text('  ' + (value || '—'));
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = supabaseAdmin();
  const [{ data: rdv, error }, { data: history }] = await Promise.all([
    db.from('rdv').select('*').eq('id', params.id).single(),
    db.from('activity_log').select('*').eq('rdv_id', params.id).order('created_at', { ascending: true }),
  ]);
  if (error || !rdv) return NextResponse.json({ error: 'RDV introuvable' }, { status: 404 });

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const chunks: Buffer[] = [];
  doc.on('data', (c) => chunks.push(c));

  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  // header
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#0E8A3E').text('ISO BAT — Dossier RDV', { align: 'left' });
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(9).fillColor('#666').text(`Genere le ${new Date().toLocaleString('fr-FR')}`);
  doc.moveDown(1);

  doc.font('Helvetica-Bold').fontSize(13).fillColor('#111').text(rdv.raison_sociale || rdv.client || 'Client non precise');
  doc.moveDown(0.8);

  // section: rendez-vous
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0E8A3E').text('Rendez-vous');
  doc.moveDown(0.3);
  line(doc, 'Date :', rdv.date ? new Date(rdv.date).toLocaleDateString('fr-FR') : null);
  line(doc, 'Heure :', rdv.heure);
  line(doc, 'Operation :', rdv.operation);
  line(doc, 'Prestataire :', rdv.prestataire);
  line(doc, 'Commercial :', rdv.commercial);
  line(doc, 'Departement :', rdv.departement);
  line(doc, 'Code postal :', rdv.code_postal);
  line(doc, 'Adresse :', rdv.adresse);
  line(doc, 'Responsable :', rdv.client);
  line(doc, 'Telephone :', rdv.telephone);
  doc.moveDown(0.8);

  // section: qualite
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0E8A3E').text('Qualite');
  doc.moveDown(0.3);
  line(doc, 'Confirmation RDV :', rdv.qualite_confirmation == null ? null : rdv.qualite_confirmation ? 'Oui' : 'Non');
  line(doc, 'Criteres respectes :', rdv.qualite_criteres_respectes == null ? null : rdv.qualite_criteres_respectes ? 'Oui' : 'Non');
  line(doc, 'Resultat :', rdv.qualite_resultat);
  line(doc, 'Commentaire qualite :', rdv.qualite_commentaire);
  doc.moveDown(0.8);

  // section: visite / retour
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0E8A3E').text('Visite & retour');
  doc.moveDown(0.3);
  line(doc, 'Statut :', rdv.statut);
  line(doc, 'Sous-statut :', rdv.sous_statut);
  line(doc, 'Commentaire :', rdv.motif);
  line(doc, 'Compte-rendu :', rdv.compte_rendu);
  line(doc, 'Nombre de reports :', String(rdv.nombre_reports || 0));
  doc.moveDown(1);

  // section: historique
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0E8A3E').text('Historique');
  doc.moveDown(0.3);
  if (!history || history.length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor('#888').text('Aucun historique enregistre.');
  } else {
    for (const h of history) {
      doc.font('Helvetica').fontSize(9).fillColor('#333').text(
        `${new Date(h.created_at).toLocaleString('fr-FR')} — ${h.user_display_name || '—'} : ${ACTION_LABELS[h.action] || h.action}${h.details ? ` (${h.details})` : ''}`
      );
    }
  }

  doc.end();
  const buffer = await done;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="RDV_${(rdv.raison_sociale || rdv.client || 'dossier').replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`,
    },
  });
}
