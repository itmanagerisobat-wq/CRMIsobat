import { NextRequest, NextResponse } from 'next/server';
import { directDb } from '@/lib/db-direct';
import { getSessionUser } from '@/lib/auth';
import { cleanFiche, deptFromCp } from '@/lib/b2c-flow';

export const dynamic = 'force-dynamic';

// GET : agent B2C = ses propres RDV ; responsable / admin / gestionnaire / viewer = tous les RDV B2C saisis a la main
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  try {
    const db = directDb();
    let rows: any[];
    if (me.role === 'agent') {
      const agentId = me.userId.startsWith('agentpin-') ? me.userId.replace('agentpin-', '') : null;
      rows = agentId
        ? (await db.query(`select * from rdv_requests where flow = 'manual' and agent_id = $1 order by created_at desc`, [agentId])).rows
        : [];
    } else if (me.role === 'relanceur') {
      rows = [];
    } else {
      rows = (await db.query(`select * from rdv_requests where flow = 'manual' and type_client = 'b2c' order by created_at desc`)).rows;
    }
    return NextResponse.json({ data: rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ data: [], error: e.message }, { status: 200 });
  }
}

// POST : un agent B2C (ou la responsable / admin / gestionnaire) saisit un RDV sans creneau
export async function POST(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me || me.role === 'viewer' || me.role === 'relanceur') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  const b = await req.json();
  if (!String(b.client || '').trim()) return NextResponse.json({ error: 'Nom et prenom obligatoires.' }, { status: 400 });
  if (!String(b.telephone || '').trim()) return NextResponse.json({ error: 'Numero de telephone obligatoire.' }, { status: 400 });
  const fiche = cleanFiche(b.fiche);
  const agentId = me.role === 'agent' && me.userId.startsWith('agentpin-') ? me.userId.replace('agentpin-', '') : null;
  try {
    const { rows } = await directDb().query(
      `insert into rdv_requests
         (flow, type_client, status, agent_id, agent_name, client, telephone, adresse, operation, fiche,
          date, heure, confirmation_statut, code_postal, departement)
       values ('manual','b2c','pending',$1,$2,$3,$4,$5,$6,$7,$8,$9,'A confirmer',$10,$11) returning *`,
      [agentId, me.role === 'agent' ? me.displayName : (b.agent_name || me.displayName),
       String(b.client).trim(), String(b.telephone).trim(), b.adresse || null, fiche.preconisation || null,
       JSON.stringify(fiche), b.date || null, b.heure || null, b.code_postal || null, deptFromCp(b.code_postal)]
    );
    return NextResponse.json({ data: rows[0] });
  } catch (e: any) {
    return NextResponse.json({ error: `Enregistrement impossible : ${e.message}` }, { status: 500 });
  }
}
