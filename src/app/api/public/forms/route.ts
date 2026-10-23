import { NextResponse } from 'next/server';
import { api } from '@/server/http';
import { submitPublicForm } from '@/server/services/public-business';
import { rateLimit, requestIp } from '@/server/security/rate-limit';
export async function POST(request: Request) { return api(async () => { rateLimit(`${requestIp(request)}:public-form`, { max: 8, windowMs: 3600_000 }); await submitPublicForm(await request.json()); return NextResponse.json({ ok: true, message: 'Votre message a été enregistré. L’équipe pourra le traiter depuis son espace.' }, { status: 201 }); }); }
