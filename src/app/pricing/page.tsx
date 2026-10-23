import type { Metadata } from 'next';
import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { getDb } from '@/server/db';
import { plans } from '@/server/db/schema';
import { seedPlans } from '@/server/db/seed';

export const metadata: Metadata = { title: 'Tarifs', description: 'Des offres lisibles pour construire et faire grandir votre site.' };
export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const db = await getDb();
  await seedPlans(db);
  const offers = await db.select().from(plans).where(eq(plans.active, true)).orderBy(asc(plans.monthlyPriceCents));
  return <div className="marketing-page"><MarketingHeader /><main className="pricing-page"><section className="pricing-intro"><span className="eyebrow">Tarification transparente</span><h1>Choisissez l’espace<br /><em>dont votre idée a besoin.</em></h1><p>Commencez gratuitement. Les offres payantes nécessitent une configuration de facturation réelle : aucun débit n’est simulé ici.</p></section><div className="pricing-grid">{offers.map((plan) => <article className={`marketing-price-card ${plan.code === 'pro' ? 'popular' : ''}`} key={plan.id}>{plan.code === 'pro' && <span className="popular-label">Le plus polyvalent</span>}<span className="plan-code">{plan.code === 'free' ? 'Pour découvrir' : plan.code === 'pro' ? 'Pour développer' : 'Pour travailler en équipe'}</span><h2>{plan.name}</h2><p>{plan.description}</p><div className="marketing-price">{plan.monthlyPriceCents === null ? <strong>Sur devis</strong> : <><strong>{plan.monthlyPriceCents === 0 ? '0 €' : `${(plan.monthlyPriceCents / 100).toLocaleString('fr-FR')} €`}</strong><span>/ mois</span></>}</div><Link className={`button ${plan.code === 'pro' ? 'coral' : 'dark'}`} href="/register">Commencer avec {plan.name}</Link><ul>{Object.entries(plan.features).filter(([key]) => key !== 'advancedEditor').map(([key, value]) => <li key={key}><span>✓</span>{key === 'maxProjects' ? `${value} projets` : key === 'maxPagesPerProject' ? `${value} pages par projet` : key === 'maxAiGenerations' ? `${value} générations IA / mois` : key === 'maxStorageBytes' ? `${Math.round(Number(value) / 1024 / 1024)} Mo de stockage` : key === 'customDomains' ? `${value} domaine(s) personnalisé(s)` : `${value} modules activables`}</li>)}</ul></article>)}</div><section className="pricing-honesty"><h2>Ce que “gratuit” veut dire ici</h2><p>Le plan Gratuit est utilisable localement sans paiement. Les prix des autres offres sont des données de catalogue configurables. Leur encaissement reste indisponible tant qu’un prestataire de paiement et ses webhooks ne sont pas configurés et vérifiés.</p></section></main></div>;
}
