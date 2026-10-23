import { redirect } from 'next/navigation';
import { getActiveWorkspace, getCurrentAuth } from '@/server/auth';
import { requireMembership } from '@/server/auth/tenancy';
import { getBillingOverview } from '@/server/services/billing';
import { BillingManager } from '@/components/app/BillingManager';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Offre et facturation' };
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const auth = await getCurrentAuth(); if (!auth) redirect('/login');
  const workspace = await getActiveWorkspace(auth.user.id); if (!workspace) redirect('/login');
  const [overview, membership, query] = await Promise.all([getBillingOverview(auth.user.id, workspace.id), requireMembership(auth.user.id, workspace.id, 'read'), searchParams]);
  const serializePlan = (plan: typeof overview.offers[number]) => ({ id: plan.id, code: plan.code, name: plan.name, description: plan.description, monthlyPriceCents: plan.monthlyPriceCents, currency: plan.currency, features: plan.features, stripePriceId: plan.stripePriceId });
  return <div className="app-page"><div className="app-page-header"><div><span className="eyebrow">Espace de travail</span><h1>Offre et utilisation</h1><p>Des quotas appliqués côté serveur et une facturation sans faux succès.</p></div></div><BillingManager canBill={membership.role === 'owner'} checkout={query.checkout ?? ''} stripeConfigured={overview.stripeConfigured} offers={overview.offers.map(serializePlan)} usage={{ ...overview.usage, plan: serializePlan(overview.usage.plan) }} /></div>;
}
