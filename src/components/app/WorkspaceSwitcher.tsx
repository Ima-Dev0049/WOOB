'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Workspace } from '@/server/db/schema';
import { apiFetch, errorMessage } from '@/lib/client-api';
import { getDictionary, type UiLocale } from '@/lib/i18n';

export function WorkspaceSwitcher({ workspaces, activeWorkspaceId, locale }: { workspaces: Workspace[]; activeWorkspaceId: string; locale: UiLocale }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const dict = getDictionary(locale);
  const active = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || workspaces[0];
  async function select(workspaceId: string) {
    if (workspaceId === active?.id) return;
    setPending(true); setError('');
    try { await apiFetch('/api/workspaces/active', { method: 'POST', body: JSON.stringify({ workspaceId }) }); router.refresh(); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setPending(false); }
  }
  return <div className="workspace-switcher"><span className="workspace-avatar">{active?.name.slice(0, 1).toUpperCase()}</span><div><strong>{active?.name}</strong><small>{dict.workspace.label}</small></div>{workspaces.length > 1 && <><select aria-label={dict.workspace.activeAria} value={active?.id} disabled={pending} onChange={(event) => select(event.target.value)}>{workspaces.map((workspace) => <option value={workspace.id} key={workspace.id}>{workspace.name}</option>)}</select><span aria-hidden="true">⌄</span></>}{error && <span className="workspace-error" role="status">{error}</span>}</div>;
}
