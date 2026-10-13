import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser, hashPassword } from '@/lib/auth';
import { listAgentPins, setAgentCredentials, revokeAgentSessions, usernameTaken } from '@/lib/agent-pins-db';
import { generatePassword, slugUsername } from '@/lib/password-gen';
import { logActivity } from '@/lib/activity';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrateur', gestionnaire: 'Gestionnaire', viewer: 'Visualisation', relanceur: 'Relanceur', responsable_b2c: 'Responsable B2C',
};

function style(ws: ExcelJS.Worksheet, widths: number[]) {
  ws.columns.forEach((c, i) => { c.width = widths[i] || 18; });
  const h = ws.getRow(1);
  h.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E8A3E' } };
    cell.alignment = { horizontal: 'center' };
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

// Exporte tous les acces en Excel. Les mots de passe etant stockes chiffres (illisibles), l'export
// GENERE de nouveaux mots de passe : agents (toujours) + comptes equipe (si includeTeam, sauf l'admin qui exporte).
export async function POST(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  const { includeTeam } = await req.json().catch(() => ({ includeTeam: false }));
  const origin = req.nextUrl.origin;

  try {
    const wb = new ExcelJS.Workbook();

    // ---- agents
    const wsA = wb.addWorksheet('Agents de prospection');
    wsA.addRow(['Nom', 'Univers', 'Identifiant', 'Mot de passe', 'Lien de connexion']);
    for (const a of await listAgentPins()) {
      let username = a.username;
      if (!username) {
        const base = slugUsername(a.name);
        username = base;
        for (let i = 2; await usernameTaken(username, a.id); i++) username = base.replace('@', `${i}@`);
      }
      const password = generatePassword();
      await setAgentCredentials(a.id, username, await hashPassword(password));
      await revokeAgentSessions(a.id);
      wsA.addRow([a.name, a.univers === 'b2c' ? 'BtoC' : 'BtoB', username, password, origin + '/login']);
    }
    style(wsA, [24, 10, 34, 26, 40]);

    // ---- equipe
    const wsU = wb.addWorksheet('Equipe');
    wsU.addRow(['Nom', 'Role', 'Identifiant', 'Mot de passe', 'Derniere connexion', 'Lien de connexion']);
    const db = supabaseAdmin();
    const { data: users, error } = await db.from('users').select('id, username, display_name, role, last_login').order('display_name');
    if (error) throw new Error(error.message);
    for (const u of users || []) {
      let pwd = '(inchange)';
      if (includeTeam && u.id !== me.userId) {
        const password = generatePassword();
        const { error: e2 } = await db.from('users').update({ password_hash: await hashPassword(password), sessions_valid_after: new Date().toISOString() }).eq('id', u.id);
        if (e2) throw new Error(e2.message);
        pwd = password;
      } else if (u.id === me.userId) pwd = '(ton compte : inchange)';
      wsU.addRow([u.display_name, ROLE_LABEL[u.role] || u.role, u.username, pwd, u.last_login ? new Date(u.last_login).toLocaleString('fr-FR') : 'Jamais', origin + '/login']);
    }
    style(wsU, [24, 18, 34, 26, 22, 40]);

    logActivity(me, 'export_access', includeTeam ? 'Export des acces (agents + equipe, mots de passe regeneres)' : 'Export des acces (agents, mots de passe regeneres)');
    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="acces-isobat.xlsx"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
