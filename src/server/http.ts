import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export function jsonError(error: unknown, requestId = crypto.randomUUID()): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: { code: error.code, message: error.message, details: error.details, requestId, retryable: error.status >= 500 } }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Certaines informations sont invalides.', details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })), requestId, retryable: false } }, { status: 422 });
  }
  if (error instanceof Error && error.name === 'DocumentValidationError') {
    return NextResponse.json({ error: { code: 'DOCUMENT_INVALID', message: 'Le document de page est invalide.', details: (error as Error & { issues?: unknown }).issues, requestId, retryable: false } }, { status: 422 });
  }
  console.error(`[${requestId}] Erreur interne`, error instanceof Error ? error.message : 'Erreur inconnue');
  return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Une erreur inattendue est survenue.', requestId, retryable: true } }, { status: 500 });
}

export function api<T>(handler: () => Promise<T>): Promise<T | NextResponse> {
  return handler().catch((error: unknown) => jsonError(error));
}

export function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
