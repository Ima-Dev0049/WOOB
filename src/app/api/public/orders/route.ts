import { NextResponse } from 'next/server';
import { api } from '@/server/http';
import { createManualOrder } from '@/server/services/public-business';
import { rateLimit, requestIp } from '@/server/security/rate-limit';
export async function POST(request: Request) { return api(async () => { rateLimit(`${requestIp(request)}:order`, { max: 8, windowMs: 3600_000 }); const order = await createManualOrder(await request.json()); return NextResponse.json({ order: { reference: order.reference, status: order.status, paymentStatus: order.paymentStatus }, message: `Commande ${order.reference} enregistrée sans paiement en ligne. Le commerçant doit confirmer la suite.` }, { status: 201 }); }); }
