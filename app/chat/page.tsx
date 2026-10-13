'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Msg { id: string; sender_id: string; sender_name: string; sender_role: string | null; body: string; image_id: string | null; created_at: string }
interface Person { user_id: string; name: string; role: string | null; online: boolean }
interface Room { id: string; name: string }
interface Conv { channel: string; n: number; last_at: string; kind: 'dm' | 'room'; title: string }

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin', gestionnaire: 'Gestionnaire', viewer: 'Visualisation', relanceur: 'Relanceur',
  responsable_b2c: 'Responsable B2C', agent: 'Agent',
};

function dmKey(a: string, b: string) { return 'dm:' + [a, b].sort().join('|'); }

// Reduit la photo (max 1600 px, JPEG) pour rester leger.
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.8));
    return blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}

export default function ChatPage() {
  const [me, setMe] = useState<{ id: string; name: string; role: string } | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [active, setActive] = useState<string>('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [adminMode, setAdminMode] = useState(false);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [adminChannel, setAdminChannel] = useState<string | null>(null);
  const [adminMsgs, setAdminMsgs] = useState<Msg[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const isAdmin = me?.role === 'admin';

  const loadState = useCallback(async () => {
    try {
      const j = await fetch('/api/chat/state', { cache: 'no-store' }).then((r) => r.json());
      if (j.me) setMe(j.me);
      setRooms(j.rooms || []);
      setPeople(j.users || []);
      setUnread(j.unread || {});
      if (j.error) setError(j.error);
      setActive((a) => a || (j.rooms?.[0]?.id ?? ''));
    } catch { /* retry */ }
  }, []);

  const loadMsgs = useCallback(async (who: string) => {
    if (!who) return;
    try {
      const j = await fetch(`/api/chat/messages?with=${encodeURIComponent(who)}`, { cache: 'no-store' }).then((r) => r.json());
      if (activeRef.current === who) setMsgs(j.data || []);
    } catch { /* retry */ }
  }, []);

  useEffect(() => { loadState(); const t = setInterval(loadState, 8000); return () => clearInterval(t); }, [loadState]);
  useEffect(() => {
    if (adminMode) return;
    setMsgs([]);
    loadMsgs(active);
    const t = setInterval(() => loadMsgs(active), 3000);
    return () => clearInterval(t);
  }, [active, adminMode, loadMsgs]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length, adminMsgs.length]);

  // vue admin
  useEffect(() => {
    if (!adminMode) return;
    const load = () => fetch('/api/chat/admin', { cache: 'no-store' }).then((r) => r.json()).then((j) => setConvs(j.data || []));
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [adminMode]);
  useEffect(() => {
    if (!adminMode || !adminChannel) return;
    const load = () => fetch(`/api/chat/admin?channel=${encodeURIComponent(adminChannel)}`, { cache: 'no-store' }).then((r) => r.json()).then((j) => setAdminMsgs(j.data || []));
    setAdminMsgs([]);
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [adminMode, adminChannel]);

  async function send() {
    if ((!text.trim() && !photo) || !active) return;
    setSending(true);
    setError('');
    const fd = new FormData();
    fd.append('with', active);
    fd.append('body', text);
    if (photo) fd.append('image', await compressImage(photo));
    const res = await fetch('/api/chat/messages', { method: 'POST', body: fd });
    setSending(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || 'Erreur'); return; }
    setText('');
    setPhoto(null);
    if (fileRef.current) fileRef.current.value = '';
    loadMsgs(active);
  }

  async function renameRoom(r: Room) {
    const name = prompt('Nouveau nom du salon :', r.name);
    if (!name || !name.trim() || name.trim() === r.name) return;
    const res = await fetch('/api/chat/rooms', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, name }),
    });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || 'Erreur'); return; }
    loadState();
  }

  const activeRoom = rooms.find((r) => r.id === active);
  const activePerson = people.find((p) => p.user_id === active);
  const title = activeRoom ? `💬 ${activeRoom.name}` : activePerson ? `✉️ ${activePerson.name}` : 'Conversation';

  function renderMsgs(list: Msg[], mineId: string | null) {
    return list.map((m) => {
      const mine = mineId !== null && mineId === m.sender_id;
      return (
        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[75%] rounded-lg px-3 py-1.5 text-sm ${mine ? 'bg-forest text-white' : 'bg-white border border-black/10'}`}>
            {!mine && <div className="text-[11px] font-semibold text-forest-dark">{m.sender_name} <span className="font-normal text-ink/40">{ROLE_LABEL[m.sender_role || ''] || ''}</span></div>}
            {m.image_id && (
              <a href={`/api/chat/image/${m.image_id}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/chat/image/${m.image_id}`} alt="photo" className="rounded-md max-h-60 mb-1" />
              </a>
            )}
            {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
            <div className={`text-[10px] mt-0.5 ${mine ? 'text-white/60' : 'text-ink/40'}`}>
              {new Date(m.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      );
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold text-ink">Messagerie</h1>
        {isAdmin && (
          <button
            onClick={() => setAdminMode((v) => !v)}
            className={`text-sm font-medium px-3 py-2 rounded-md border transition-colors ${adminMode ? 'bg-ink text-white border-ink' : 'bg-white text-ink border-black/10 hover:bg-forest-light'}`}
          >
            🗂️ Historique (admin)
          </button>
        )}
      </div>

      {adminMode && isAdmin ? (
        <div className="bg-white rounded-lg border border-black/5 flex h-[70vh] overflow-hidden">
          <aside className="w-72 shrink-0 border-r border-black/5 overflow-y-auto">
            <p className="px-3 py-2 text-[11px] text-ink/50 bg-gold-light">Vue administrateur : lecture seule, invisible pour les utilisateurs.</p>
            {convs.length === 0 && <p className="px-3 py-2 text-xs text-ink/40 italic">Aucune conversation.</p>}
            {convs.map((c) => (
              <button
                key={c.channel}
                onClick={() => setAdminChannel(c.channel)}
                className={`w-full text-left px-3 py-2.5 text-sm border-b border-black/5 ${adminChannel === c.channel ? 'bg-forest-light font-semibold' : 'hover:bg-forest-light/50'}`}
              >
                <div>{c.kind === 'room' ? '💬' : '✉️'} {c.title}</div>
                <div className="text-[11px] text-ink/40">{c.n} message{c.n > 1 ? 's' : ''} · dernier : {new Date(c.last_at).toLocaleString('fr-FR')}</div>
              </button>
            ))}
          </aside>
          <section className="flex-1 flex flex-col min-w-0">
            <div className="px-4 py-2.5 border-b border-black/5 font-semibold text-sm">
              {convs.find((c) => c.channel === adminChannel)?.title || 'Choisis une conversation'}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-black/[0.02]">
              {renderMsgs(adminMsgs, null)}
              <div ref={bottomRef} />
            </div>
          </section>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-black/5 flex h-[70vh] overflow-hidden">
          <aside className="w-56 shrink-0 border-r border-black/5 overflow-y-auto">
            {rooms.map((r) => (
              <div key={r.id} className={`flex items-center ${active === r.id ? 'bg-forest-light' : 'hover:bg-forest-light/50'}`}>
                <button onClick={() => setActive(r.id)} className={`flex-1 text-left px-3 py-2.5 text-sm flex items-center justify-between min-w-0 ${active === r.id ? 'font-semibold' : ''}`}>
                  <span className="truncate">💬 {r.name}</span>
                  {(unread[r.id] || 0) > 0 && <Badge n={unread[r.id]} />}
                </button>
                {isAdmin && (
                  <button onClick={() => renameRoom(r)} title="Renommer le salon" className="px-2 text-ink/40 hover:text-ink text-xs">✏️</button>
                )}
              </div>
            ))}
            <div className="px-3 pt-3 pb-1 text-[11px] uppercase tracking-wide text-ink/40">Messages prives</div>
            {people.length === 0 && <p className="px-3 text-xs text-ink/40 italic">Personne d'autre pour l'instant.</p>}
            {people.map((p) => {
              const n = me ? unread[dmKey(me.id, p.user_id)] || 0 : 0;
              return (
                <button
                  key={p.user_id}
                  onClick={() => setActive(p.user_id)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${active === p.user_id ? 'bg-forest-light font-semibold' : 'hover:bg-forest-light/50'}`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${p.online ? 'bg-green-500' : 'bg-black/20'}`} />
                    <span className="truncate">{p.name}</span>
                    <span className="text-[10px] text-ink/40 shrink-0">{ROLE_LABEL[p.role || ''] || ''}</span>
                  </span>
                  {n > 0 && <Badge n={n} />}
                </button>
              );
            })}
          </aside>

          <section className="flex-1 flex flex-col min-w-0">
            <div className="px-4 py-2.5 border-b border-black/5 font-semibold text-sm">
              {title}
              {activePerson && <span className="ml-2 text-xs font-normal text-ink/50">{activePerson.online ? 'en ligne' : 'hors ligne'}</span>}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-black/[0.02]">
              {msgs.length === 0 && <p className="text-xs text-ink/40 italic">Aucun message. Ecris le premier !</p>}
              {renderMsgs(msgs, me?.id ?? null)}
              <div ref={bottomRef} />
            </div>
            {error && <p className="text-xs text-statut-annule px-4 py-1">{error}</p>}
            {photo && (
              <div className="px-3 pt-2 text-xs text-ink/60 flex items-center gap-2">
                📷 {photo.name}
                <button onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = ''; }} className="text-statut-annule">retirer</button>
              </div>
            )}
            <div className="p-3 border-t border-black/5 flex gap-2 items-end">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
              <button onClick={() => fileRef.current?.click()} title="Envoyer une photo" className="border border-black/10 hover:bg-forest-light rounded-md px-3 py-2 text-sm">📷</button>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={1}
                placeholder="Ecris un message… (Entree pour envoyer)"
                className="flex-1 border border-black/10 rounded-md px-3 py-2 text-sm resize-none"
              />
              <button onClick={send} disabled={sending || (!text.trim() && !photo)} className="bg-forest hover:bg-forest-dark text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-40">
                {sending ? '...' : 'Envoyer'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Badge({ n }: { n: number }) {
  return <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{n}</span>;
}
