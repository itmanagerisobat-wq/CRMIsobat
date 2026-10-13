'use client';

import { useEffect, useState } from 'react';

export type Role = 'admin' | 'gestionnaire' | 'viewer' | 'relanceur' | 'responsable_b2c' | 'agent' | null;

interface RoleInfo {
  role: Role;
  displayName: string;
}

function readRoleCookie(): RoleInfo {
  if (typeof document === 'undefined') return { role: null, displayName: '' };
  const match = document.cookie.match(/(?:^|; )isobat_role=([^;]*)/);
  if (!match) return { role: null, displayName: '' };
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1]));
    const role = ['admin', 'gestionnaire', 'viewer', 'relanceur', 'responsable_b2c', 'agent'].includes(parsed.role) ? parsed.role : null;
    return { role, displayName: parsed.displayName || '' };
  } catch {
    // backward compatibility with the old plain-string cookie format
    const val = decodeURIComponent(match[1]);
    const role = ['admin', 'gestionnaire', 'viewer', 'relanceur', 'responsable_b2c', 'agent'].includes(val) ? (val as Role) : null;
    return { role, displayName: '' };
  }
}

/** UI-only role hint (hide/show buttons). Actual enforcement always happens
 * server-side (middleware + API routes) regardless of what this returns. */
export function useRole(): Role {
  const [role, setRole] = useState<Role>(null);
  useEffect(() => {
    setRole(readRoleCookie().role);
  }, []);
  return role;
}

export function useDisplayName(): string {
  const [name, setName] = useState('');
  useEffect(() => {
    setName(readRoleCookie().displayName);
  }, []);
  return name;
}
