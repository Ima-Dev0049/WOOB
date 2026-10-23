import { NextResponse } from 'next/server';
import { api } from '@/server/http';
import { submitReservation } from '@/server/services/public-business';
import { rateLimit, requestIp } from '@/server/security/rate-limit';
export async function POST(request: Request) { return api(async () => { rateLimit(`${requestIp(request)}:reservation`, { max: 8, windowMs: 3600_000 }); await submitReservation(await request.json()); return NextResponse.json({ ok: true, message: 'Votre demande est enregistrée, en attente de confirmation. Aucun créneau n’est garanti automatiquement.' }, { status: 201 }); }); }
