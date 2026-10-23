'use client';

export class ClientApiError extends Error {
  constructor(message: string, public status: number, public code: string, public details?: unknown) { super(message); }
}

export function clientCookie(name: string): string {
  const entry = document.cookie.split(';').map((value) => value.trim()).find((value) => value.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : '';
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers.set('x-csrf-token', clientCookie('woob_csrf'));
  const response = await fetch(url, { ...options, headers });
  const body = await response.json().catch(() => ({})) as T & { error?: { message?: string; code?: string; details?: unknown } };
  if (!response.ok) throw new ClientApiError(body.error?.message || `Requête impossible (${response.status}).`, response.status, body.error?.code || 'REQUEST_FAILED', body.error?.details);
  return body;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Une erreur inattendue est survenue.';
}
