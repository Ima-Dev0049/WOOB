import Stripe from 'stripe';
import { and, asc, eq, or } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@/lib/id';
import { getDb, type Db } from '@/server/db';
import { plans, processedEvents, subscriptions, users } from '@/server/db/schema';
import { ApiError } from '@/server/http';
import { requireMembership } from '@/server/auth/tenancy';
import { getUsageSummary } from './quotas';

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new ApiError(503, 'BILLING_NOT_CONFIGURED', 'Aucun prestataire de paiement n’est configuré. Aucun débit ni changement d’offre n’a été effectué.');
  return new Stripe(key, { timeout: 30_000, maxNetworkRetries: 1 });
}

export async function getBillingOverview(userId: string, workspaceId: string, db?: Db) {
  const database = db ?? await getDb();
  await requireMembership(userId, workspaceId, 'read', database);
  const [usage, offers, subscriptionRows] = await Promise.all([
    getUsageSummary(workspaceId, database),
    database.select().from(plans).where(eq(plans.active, true)).orderBy(asc(plans.monthlyPriceCents)),
    database.select().from(subscriptions).where(eq(subscriptions.workspaceId, workspaceId)).limit(1),
  ]);
  return { usage, offers, subscription: subscriptionRows[0], stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY) };
}

export async function createCheckout(userId: string, workspaceId: string, input: unknown, db?: Db): Promise<string> {
  const database = db ?? await getDb();
  await requireMembership(userId, workspaceId, 'billing', database);
  const { planId } = z.object({ planId: z.uuid() }).parse(input);
  const plan = (await database.select().from(plans).where(and(eq(plans.id, planId), eq(plans.active, true))).limit(1))[0];
  if (!plan || !plan.monthlyPriceCents) throw new ApiError(422, 'PLAN_NOT_BILLABLE', 'Cette offre ne possède pas de checkout mensuel.');
  if (!plan.stripePriceId) throw new ApiError(503, 'PLAN_PRICE_NOT_CONFIGURED', 'L’identifiant de prix Stripe de cette offre n’est pas configuré.');
  const appUrl = process.env.APP_URL;
  if (!appUrl || !/^https?:\/\//.test(appUrl)) throw new ApiError(503, 'APP_URL_NOT_CONFIGURED', 'APP_URL doit être une URL HTTP(S) absolue pour le retour du checkout.');
  const stripe = stripeClient();
  const current = (await database.select().from(subscriptions).where(eq(subscriptions.workspaceId, workspaceId)).limit(1))[0];
  if (!current) throw new ApiError(409, 'SUBSCRIPTION_MISSING', 'Abonnement local introuvable.');
  let customerId = current.providerCustomerId;
  if (!customerId) {
    const user = (await database.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, userId)).limit(1))[0];
    const customer = await stripe.customers.create({ ...(user?.email ? { email: user.email } : {}), ...(user?.name ? { name: user.name } : {}), metadata: { workspaceId } });
    customerId = customer.id;
    await database.update(subscriptions).set({ provider: 'stripe', providerCustomerId: customerId, updatedAt: new Date() }).where(eq(subscriptions.workspaceId, workspaceId));
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription', customer: customerId, line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    client_reference_id: workspaceId, metadata: { workspaceId, planId: plan.id },
    subscription_data: { metadata: { workspaceId, planId: plan.id } },
    success_url: `${appUrl}/dashboard/billing?checkout=pending`, cancel_url: `${appUrl}/dashboard/billing?checkout=cancelled`,
    allow_promotion_codes: false,
  });
  if (!session.url) throw new ApiError(502, 'CHECKOUT_URL_MISSING', 'Le prestataire n’a pas fourni d’URL de checkout.');
  return session.url;
}

function subscriptionStatus(status: Stripe.Subscription.Status): string {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'past_due' || status === 'unpaid') return 'past_due';
  if (status === 'paused') return 'paused';
  return 'cancelled';
}

async function syncSubscription(eventId: string, subscription: Stripe.Subscription, workspaceHint: string | undefined, db: Db) {
  await db.transaction(async (tx) => {
    const inserted = await tx.insert(processedEvents).values({ id: createId('event'), provider: 'stripe', providerEventId: eventId }).onConflictDoNothing().returning();
    if (!inserted.length) return;
    const priceId = subscription.items.data[0]?.price.id;
    const existing = (await tx.select().from(subscriptions).where(or(eq(subscriptions.providerSubscriptionId, subscription.id), eq(subscriptions.providerCustomerId, subscription.customer as string))).limit(1))[0];
    const workspaceId = subscription.metadata.workspaceId || workspaceHint || existing?.workspaceId;
    if (!workspaceId) throw new ApiError(422, 'BILLING_WORKSPACE_UNKNOWN', 'L’événement ne référence aucun espace Woob connu.');
    const offeredPlan = priceId ? (await tx.select().from(plans).where(eq(plans.stripePriceId, priceId)).limit(1))[0] : undefined;
    const current = existing ?? (await tx.select().from(subscriptions).where(eq(subscriptions.workspaceId, workspaceId)).limit(1))[0];
    if (!current || current.workspaceId !== workspaceId) throw new ApiError(422, 'SUBSCRIPTION_MISMATCH', 'L’abonnement ne correspond pas à cet espace.');
    const status = subscriptionStatus(subscription.status);
    if (status === 'active' && !offeredPlan) throw new ApiError(422, 'BILLING_PRICE_UNKNOWN', 'Impossible d’activer un prix Stripe inconnu.');
    const periodEnd = subscription.items.data[0]?.current_period_end;
    await tx.update(subscriptions).set({
      planId: status === 'active' ? offeredPlan!.id : current.planId,
      provider: 'stripe', providerCustomerId: subscription.customer as string, providerSubscriptionId: subscription.id,
      status, currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null, updatedAt: new Date(),
    }).where(eq(subscriptions.workspaceId, workspaceId));
  });
}

export async function handleStripeWebhook(payload: string, signature: string | null, db?: Db) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) throw new ApiError(503, 'WEBHOOK_NOT_CONFIGURED', 'Le secret de webhook Stripe n’est pas configuré.');
  const stripe = stripeClient();
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(payload, signature || '', process.env.STRIPE_WEBHOOK_SECRET); }
  catch { throw new ApiError(400, 'WEBHOOK_SIGNATURE_INVALID', 'Signature du webhook invalide.'); }
  const database = db ?? await getDb();
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.mode === 'subscription' && typeof session.subscription === 'string') {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      await syncSubscription(event.id, subscription, session.client_reference_id || session.metadata?.workspaceId || undefined, database);
      return { received: true };
    }
  }
  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    await syncSubscription(event.id, event.data.object, undefined, database);
    return { received: true };
  }
  await database.insert(processedEvents).values({ id: createId('event'), provider: 'stripe', providerEventId: event.id }).onConflictDoNothing();
  return { received: true, ignored: true };
}
