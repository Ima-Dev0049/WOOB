import { NextResponse } from 'next/server';
import { api } from '@/server/http';
import { handleStripeWebhook } from '@/server/services/billing';
export async function POST(request: Request) { return api(async () => NextResponse.json(await handleStripeWebhook(await request.text(), request.headers.get('stripe-signature')))); }
