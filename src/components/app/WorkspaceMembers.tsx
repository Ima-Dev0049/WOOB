'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, errorMessage } from '@/lib/client-api';
import { getDictionary, type UiLocale } from '@/lib/i18n';

type Member = { userId: string; role: string; status: string; user: { id: string; name: string; email: string } };
export function WorkspaceMembers({ workspaceId, ownerId, actorId, actorRole, members, locale }: { workspaceId: string; ownerId: string; actorId: string; actorRole: string; members: Member[]; locale: UiLocale }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [roleOverrides, setRoleOverrides] = useState<Record<string, string>>({});
  const router = useRouter();
  const dict = getDictionary(locale);
  const canManage = actorRole === 'owner' || actorRole === 'admin';
  async function run(action: () => Promise<unknown>, success: string) {
    setPending(true); setMessage('');
    try { await action(); setMessage(success); router.refresh(); return true; }
    catch (error) { setMessage(errorMessage(error)); return false; }
    finally { setPending(false); }
  }
  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const saved = await run(() => apiFetch(`/api/workspaces/${workspaceId}/members`, { method: 'POST', body: JSON.stringify({ email: values.get('email'), role: values.get('role') }) }), dict.members.added);
    if (saved) form.reset();
  }
  function canEdit(member: Member) {
    if (member.userId === ownerId) return false;
    if (actorRole === 'owner') return true;
    return actorRole === 'admin' && member.role !== 'admin';
  }
  const roleOptions = <><option value="editor">{dict.members.editor}</option><option value="contributor">{dict.members.contributor}</option><option value="viewer">{dict.members.viewer}</option>{actorRole === 'owner' && <option value="admin">{dict.members.admin}</option>}</>;
  return <section className="settings-card members-card"><header><div><h2>{dict.members.title}</h2><p>{dict.members.subtitle}</p></div><span className="status-pill">{dict.members.activeCount(members.filter((member) => member.status === 'active').length)}</span></header>{canManage && <form className="member-add-form" onSubmit={add}><label>{dict.members.existingEmail}<input name="email" type="email" required placeholder="personne@example.com" /></label><label>{dict.members.role}<select name="role" defaultValue="editor">{roleOptions}</select></label><button className="button dark small" disabled={pending}>{dict.members.add}</button></form>}{message && <p className="form-status" role="status">{message}</p>}<div className="member-list">{members.map((member) => <article key={member.userId}><div className="member-identity"><span>{member.user.name.slice(0, 1).toUpperCase()}</span><div><strong>{member.user.name}{member.userId === actorId ? ` ${dict.members.you}` : ''}</strong><small>{member.user.email}</small></div></div><span className={`status-pill ${member.status === 'active' ? 'published' : ''}`}>{member.status === 'active' ? dict.members.active : dict.members.suspended}</span>{member.userId === ownerId ? <span className="member-owner">{dict.members.owner}</span> : canManage && canEdit(member) ? <div className="member-actions"><select aria-label={dict.members.roleFor(member.user.name)} value={roleOverrides[member.userId] ?? member.role} disabled={pending} onChange={async (event) => { const role = event.target.value; setRoleOverrides((current) => ({ ...current, [member.userId]: role })); const saved = await run(() => apiFetch(`/api/workspaces/${workspaceId}/members/${member.userId}`, { method: 'PATCH', body: JSON.stringify({ role }) }), dict.members.roleSaved); if (!saved) setRoleOverrides((current) => { const next = { ...current }; delete next[member.userId]; return next; }); }}>{roleOptions}</select><button className="button ghost small" disabled={pending} onClick={() => run(() => apiFetch(`/api/workspaces/${workspaceId}/members/${member.userId}`, { method: 'DELETE' }), dict.members.suspendedSuccess)}>{dict.members.suspend}</button></div> : <span className="muted">{member.role}</span>}</article>)}</div></section>;
}
