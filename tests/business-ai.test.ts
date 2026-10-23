import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { DatabaseContext } from '@/server/db';
import { testDatabase, createAccount } from './helpers/database';
import { createProject, savePageDocument } from '@/server/services/projects';
import { publishProject } from '@/server/services/publishing';
import { createManualOrder, submitPublicForm, submitReservation } from '@/server/services/public-business';
import { updateOrderStatus } from '@/server/services/business';
import { orders, products, formSubmissions, reservations, plans, subscriptions, domains, aiGenerations } from '@/server/db/schema';
import { addDomain, listDomains, verifyDomain } from '@/server/services/domains';
import { createCheckout, handleStripeWebhook } from '@/server/services/billing';
import { generateAiProposal } from '@/server/services/ai';
import { applyAiProposal } from '@/lib/document/ai';
import { findNode } from '@/lib/document/validation';
import { makeNode } from '@/lib/document/factory';
import { flattenNodes } from '@/lib/document/operations';

let context: DatabaseContext;
beforeAll(async () => { context = await testDatabase(); process.env.AI_PROVIDER = 'demo'; }, 60_000);
afterAll(async () => { await context.close(); });

describe('modules métier réels', () => {
  it('enregistre une commande au prix serveur, décrémente puis restaure le stock', async () => {
    const account = await createAccount(context.db, 'shop@example.com', 'Shop');
    const details = await createProject(account.user.id, account.workspace.id, { name: 'Boutique test', description: '', templateId: 'market-epices' }, context.db);
    await publishProject(account.user.id, details.project.id, context.db);
    const product = details.products[0]!;
    const order = await createManualOrder({ projectId: details.project.id, customerName: 'Client Test', customerEmail: 'client@example.com', items: [{ productId: product.id, quantity: 1 }, { productId: product.id, quantity: 1 }] }, context.db);
    expect(order.totalCents).toBe(product.priceCents * 2);
    expect(order.paymentStatus).toBe('unpaid');
    if (product.inventory !== null) expect((await context.db.select().from(products).where(eq(products.id, product.id)))[0]!.inventory).toBe(product.inventory - 2);
    await updateOrderStatus(account.user.id, details.project.id, order.id, 'confirmed', context.db);
    await updateOrderStatus(account.user.id, details.project.id, order.id, 'cancelled', context.db);
    if (product.inventory !== null) expect((await context.db.select().from(products).where(eq(products.id, product.id)))[0]!.inventory).toBe(product.inventory);
    await expect(updateOrderStatus(account.user.id, details.project.id, order.id, 'confirmed', context.db)).rejects.toMatchObject({ status: 409 });
    expect((await context.db.select().from(orders).where(eq(orders.id, order.id)))[0]!.paymentStatus).toBe('unpaid');
  });

  it('enregistre les formulaires et les réservations avec leurs notes', async () => {
    const account = await createAccount(context.db, 'booking@example.com', 'Booking');
    const details = await createProject(account.user.id, account.workspace.id, { name: 'Restaurant test', description: '', templateId: 'restaurant-safran' }, context.db);
    await publishProject(account.user.id, details.project.id, context.db);
    await submitPublicForm({ projectId: details.project.id, formKey: 'contact', name: 'Visiteur Test', email: 'visiteur@example.com', message: 'Bonjour, je souhaite un échange.' }, context.db);
    expect(await context.db.select().from(formSubmissions).where(eq(formSubmissions.projectId, details.project.id))).toHaveLength(1);
    const requestedAt = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 16);
    await submitReservation({ projectId: details.project.id, serviceName: 'Table au restaurant', name: 'Visiteur Test', email: 'visiteur@example.com', requestedAt, partySize: 4, notes: 'Table près de la fenêtre' }, context.db);
    const saved = await context.db.select().from(reservations).where(eq(reservations.projectId, details.project.id));
    expect(saved).toHaveLength(1);
    expect(saved[0]!.notes).toBe('Table près de la fenêtre');
    expect(saved[0]!.status).toBe('pending');
  });
});

describe('domaines et dépendances DNS/TLS', () => {
  it('applique le quota, conserve seulement le hash du TXT et ne simule pas la vérification', async () => {
    const account = await createAccount(context.db, 'domains@example.com', 'Domains');
    const other = await createAccount(context.db, 'domains-other@example.com', 'Other');
    const details = await createProject(account.user.id, account.workspace.id, { name: 'Projet domaines', description: '', templateId: 'studio-business' }, context.db);
    await expect(addDomain(account.user.id, details.project.id, { hostname: 'www.boutique.example' }, context.db)).rejects.toMatchObject({ status: 429 });
    const pro = (await context.db.select().from(plans).where(eq(plans.code, 'pro')))[0]!;
    await context.db.update(subscriptions).set({ planId: pro.id }).where(eq(subscriptions.workspaceId, account.workspace.id));
    await expect(addDomain(account.user.id, details.project.id, { hostname: 'javascript:alert(1)' }, context.db)).rejects.toMatchObject({ status: 422 });
    const added = await addDomain(account.user.id, details.project.id, { hostname: 'WWW.Boutique.example.' }, context.db);
    expect(added.domain.state).toBe('pending_dns');
    expect(added.domain.hostname).toBe('www.boutique.example');
    expect(added.verification.name).toBe('_woob.www.boutique.example');
    expect(added.domain).not.toHaveProperty('verificationTokenHash');
    const storedDomain = (await context.db.select().from(domains).where(eq(domains.id, added.domain.id)))[0]!;
    expect(storedDomain.verificationTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storedDomain.verificationTokenHash).not.toContain(added.verification.value);
    await expect(listDomains(other.user.id, details.project.id, context.db)).rejects.toMatchObject({ status: 404 });
    delete process.env.DNS_VERIFICATION_ENABLED;
    await expect(verifyDomain(account.user.id, added.domain.id, context.db)).rejects.toMatchObject({ status: 503, code: 'DNS_VERIFICATION_UNAVAILABLE' });
    expect((await context.db.select().from(domains).where(eq(domains.id, added.domain.id)))[0]!.state).toBe('pending_dns');
  });
});

describe('facturation sans faux paiement', () => {
  it('refuse le checkout et le webhook avant tout effet lorsque Stripe est absent', async () => {
    const account = await createAccount(context.db, 'billing@example.com', 'Billing');
    const pro = (await context.db.select().from(plans).where(eq(plans.code, 'pro')))[0]!;
    await context.db.update(plans).set({ monthlyPriceCents: 1900, stripePriceId: 'price_test_not_called' }).where(eq(plans.id, pro.id));
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    process.env.APP_URL = 'http://localhost:3000';
    await expect(createCheckout(account.user.id, account.workspace.id, { planId: pro.id }, context.db)).rejects.toMatchObject({ status: 503, code: 'BILLING_NOT_CONFIGURED' });
    await expect(handleStripeWebhook('{}', null, context.db)).rejects.toMatchObject({ status: 503, code: 'WEBHOOK_NOT_CONFIGURED' });
    const subscription = (await context.db.select().from(subscriptions).where(eq(subscriptions.workspaceId, account.workspace.id)))[0]!;
    expect(subscription.providerCustomerId).toBeNull();
    expect(subscription.providerSubscriptionId).toBeNull();
    expect(subscription.planId).not.toBe(pro.id);
  });
});

describe('IA structurée et mode démo', () => {
  it('journalise une proposition démo sans modifier le document avant application', async () => {
    const account = await createAccount(context.db, 'ai@example.com', 'AI');
    const details = await createProject(account.user.id, account.workspace.id, { name: 'Projet IA', description: '', templateId: 'studio-business' }, context.db);
    const page = details.pages[0]!;
    const heading = makeNode('heading', { text: 'Titre initial', level: 2 });
    page.draftDocument.root.children!.push(heading);
    await savePageDocument(account.user.id, page.id, { baseRevision: 0, document: page.draftDocument }, context.db);
    const original = page.draftDocument.root.children!.at(-1)!.props.text;
    const generated = await generateAiProposal(account.user.id, page.id, { instruction: 'Studio de céramique durable', selectedNodeId: heading.id }, context.db);
    expect(generated.demo).toBe(true);
    expect(generated.provider).toBe('demo');
    expect(page.draftDocument.root.children!.at(-1)!.props.text).toBe(original);
    const preview = applyAiProposal(page.draftDocument, generated.proposal);
    expect(findNode(preview.root, heading.id)?.props.text).toContain('Studio de céramique durable');
    expect(findNode(page.draftDocument.root, heading.id)?.props.text).toBe('Titre initial');
  });

  it('rejoue une réponse terminée avec la même clé sans créer de doublon', async () => {
    const account = await createAccount(context.db, 'aiidempotency@example.com', 'AI Idempotency');
    const details = await createProject(account.user.id, account.workspace.id, { name: 'Projet IA idempotente', description: '', templateId: 'studio-business' }, context.db);
    const page = details.pages[0]!;
    const target = flattenNodes(page.draftDocument.root).find((node) => node.type === 'hero')!;
    const requestId = crypto.randomUUID();
    const input = { instruction: 'Un atelier de céramique lumineux', selectedNodeId: target.id, requestId };
    const first = await generateAiProposal(account.user.id, page.id, input, context.db);
    const replay = await generateAiProposal(account.user.id, page.id, input, context.db);
    expect(first.replayed).toBe(false);
    expect(replay).toMatchObject({ id: first.id, requestId, replayed: true });
    expect(replay.proposal).toEqual(first.proposal);
    const rows = await context.db.select().from(aiGenerations).where(eq(aiGenerations.requestKey, requestId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ pageId: page.id, selectedNodeId: target.id, baseRevision: page.draftRevision, attempts: 1, state: 'completed' });
    expect(rows[0]!.requestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(rows[0]!.leaseExpiresAt).toBeNull();
    await expect(generateAiProposal(account.user.id, page.id, { ...input, instruction: 'Une consigne différente' }, context.db)).rejects.toMatchObject({ status: 409, code: 'AI_REQUEST_MISMATCH' });
    expect(await context.db.select().from(aiGenerations).where(eq(aiGenerations.requestKey, requestId))).toHaveLength(1);
  });

  it('refuse un doublon actif puis reprend un bail expiré sans nouvelle ligne', async () => {
    const account = await createAccount(context.db, 'airecovery@example.com', 'AI Recovery');
    const details = await createProject(account.user.id, account.workspace.id, { name: 'Projet IA reprise', description: '', templateId: 'studio-business' }, context.db);
    const page = details.pages[0]!;
    const target = flattenNodes(page.draftDocument.root).find((node) => node.type === 'hero')!;
    const requestId = crypto.randomUUID();
    const input = { instruction: 'Un atelier de céramique durable', selectedNodeId: target.id, requestId };
    const first = await generateAiProposal(account.user.id, page.id, input, context.db);
    await context.db.update(aiGenerations).set({ state: 'processing', output: null, completedAt: null, leaseExpiresAt: new Date(Date.now() + 60_000) }).where(eq(aiGenerations.id, first.id));
    await expect(generateAiProposal(account.user.id, page.id, input, context.db)).rejects.toMatchObject({ status: 409, code: 'AI_GENERATION_IN_PROGRESS' });
    expect((await context.db.select().from(aiGenerations).where(eq(aiGenerations.id, first.id)))[0]!.attempts).toBe(1);

    await context.db.update(aiGenerations).set({ leaseExpiresAt: new Date(Date.now() - 1000) }).where(eq(aiGenerations.id, first.id));
    const recovered = await generateAiProposal(account.user.id, page.id, input, context.db);
    expect(recovered).toMatchObject({ id: first.id, requestId, replayed: false });
    const row = (await context.db.select().from(aiGenerations).where(eq(aiGenerations.id, first.id)))[0]!;
    expect(row).toMatchObject({ state: 'completed', attempts: 2 });
    expect(row.leaseExpiresAt).toBeNull();
    expect(await context.db.select().from(aiGenerations).where(eq(aiGenerations.requestKey, requestId))).toHaveLength(1);
    expect((await generateAiProposal(account.user.id, page.id, input, context.db)).replayed).toBe(true);
  });

  it('refuse la reprise expirée si la page a changé depuis la demande initiale', async () => {
    const account = await createAccount(context.db, 'aistale@example.com', 'AI Stale');
    const details = await createProject(account.user.id, account.workspace.id, { name: 'Projet IA révision', description: '', templateId: 'studio-business' }, context.db);
    const page = details.pages[0]!;
    const target = flattenNodes(page.draftDocument.root).find((node) => node.type === 'hero')!;
    const requestId = crypto.randomUUID();
    const input = { instruction: 'Une proposition devenue obsolète', selectedNodeId: target.id, requestId };
    const first = await generateAiProposal(account.user.id, page.id, input, context.db);
    await context.db.update(aiGenerations).set({ state: 'processing', output: null, completedAt: null, leaseExpiresAt: new Date(Date.now() - 1000) }).where(eq(aiGenerations.id, first.id));
    const changed = structuredClone(page.draftDocument);
    findNode(changed.root, target.id)!.props.title = 'Modification indépendante conservée';
    await savePageDocument(account.user.id, page.id, { baseRevision: page.draftRevision, document: changed }, context.db);
    await expect(generateAiProposal(account.user.id, page.id, input, context.db)).rejects.toMatchObject({ status: 409, code: 'AI_PAGE_CHANGED' });
    const row = (await context.db.select().from(aiGenerations).where(eq(aiGenerations.id, first.id)))[0]!;
    expect(row).toMatchObject({ state: 'failed', errorCode: 'AI_PAGE_CHANGED', attempts: 1 });
    expect(findNode(changed.root, target.id)?.props.title).toBe('Modification indépendante conservée');
  });

  it('propose la 3D sur demande explicite puis la reconfigure sans écraser ses autres réglages', async () => {
    const account = await createAccount(context.db, 'ai3d@example.com', 'AI 3D');
    const details = await createProject(account.user.id, account.workspace.id, { name: 'Projet IA 3D', description: '', templateId: 'studio-business' }, context.db);
    const page = details.pages[0]!;
    const generic = await generateAiProposal(account.user.id, page.id, { instruction: 'Rends ce portfolio plus premium' }, context.db);
    expect(generic.proposal.operations.some((operation) => operation.kind === 'scene3d')).toBe(false);
    await expect(generateAiProposal(account.user.id, page.id, { instruction: 'Supprime la scène 3D' }, context.db)).rejects.toMatchObject({ status: 422, code: 'SCENE3D_NOT_FOUND' });

    const generated = await generateAiProposal(account.user.id, page.id, { instruction: 'Ajoute une scène 3D orbitale économe' }, context.db);
    expect(generated.demo).toBe(true);
    expect(generated.proposal.operations[0]).toMatchObject({ kind: 'scene3d', action: 'insert', props: { preset: 'orbital', quality: 'low' } });
    expect(flattenNodes(page.draftDocument.root).some((node) => node.type === 'scene3d')).toBe(false);
    const preview = applyAiProposal(page.draftDocument, generated.proposal);
    const scene = flattenNodes(preview.root).find((node) => node.type === 'scene3d')!;
    expect(scene.props.title).toBe('Une matière à explorer');
    await savePageDocument(account.user.id, page.id, { baseRevision: 0, document: preview }, context.db);

    const changed = await generateAiProposal(account.user.id, page.id, { instruction: 'Passe la scène 3D en prisme sans rotation', selectedNodeId: scene.id }, context.db);
    expect(changed.proposal.operations[0]).toMatchObject({ kind: 'scene3d', action: 'update', targetId: scene.id, props: { preset: 'prism', autoRotate: false } });
    const updated = applyAiProposal(preview, changed.proposal);
    expect(findNode(updated.root, scene.id)?.props).toMatchObject({ title: 'Une matière à explorer', quality: 'low', preset: 'prism', autoRotate: false });
    expect(findNode(preview.root, scene.id)?.props.preset).toBe('orbital');
  });

  it('propose une parallaxe ciblée sur copie et permet son retrait sans muter l’aperçu', async () => {
    const account = await createAccount(context.db, 'aimotion@example.com', 'AI Motion');
    const details = await createProject(account.user.id, account.workspace.id, { name: 'Projet IA Motion', description: '', templateId: 'studio-business' }, context.db);
    const document = details.pages[0]!.draftDocument;
    const target = flattenNodes(document.root).find((node) => node.type === 'hero')!;
    const original = structuredClone(document);
    const generated = await generateAiProposal(account.user.id, details.pages[0]!.id, { instruction: 'Ajoute une parallaxe de 64 px liée au défilement', selectedNodeId: target.id }, context.db);
    expect(generated.demo).toBe(true);
    expect(generated.proposal.operations[0]).toMatchObject({ kind: 'updateMotion', nodeId: target.id, motion: { preset: 'parallax', trigger: 'scroll', distance: 64 } });
    expect(document).toEqual(original);
    const preview = applyAiProposal(document, generated.proposal);
    expect(findNode(preview.root, target.id)?.motion).toMatchObject({ preset: 'parallax', trigger: 'scroll', distance: 64 });
    expect(document).toEqual(original);
    const removed = applyAiProposal(preview, { summary: 'Retirer le mouvement', operations: [{ kind: 'updateMotion', nodeId: target.id, motion: null }] });
    expect(findNode(removed.root, target.id)?.motion).toBeUndefined();
    expect(findNode(preview.root, target.id)?.motion?.trigger).toBe('scroll');

    const saturated = structuredClone(document);
    const headings = Array.from({ length: 4 }, (_, index) => makeNode('heading', { text: `Titre ${index + 1}`, level: 2 }));
    saturated.root.children!.push(...headings);
    for (const heading of headings.slice(0, 3)) heading.motion = { preset: 'parallax', trigger: 'scroll', duration: 460, delay: 0, distance: 48 };
    expect(() => applyAiProposal(saturated, { summary: 'Quatrième effet', operations: [{ kind: 'updateMotion', nodeId: headings[3]!.id, motion: { preset: 'parallax', trigger: 'scroll', duration: 460, delay: 0, distance: 48 } }] })).toThrow(/trois effets/);
  });

  it('rejette les propriétés arbitraires et les URL dangereuses dans une proposition', async () => {
    const account = await createAccount(context.db, 'aisafe@example.com', 'AI Safe');
    const details = await createProject(account.user.id, account.workspace.id, { name: 'Projet IA sécurité', description: '', templateId: 'studio-business' }, context.db);
    const document = details.pages[0]!.draftDocument;
    const target = document.root.children![0]!;
    expect(() => applyAiProposal(document, { summary: 'Injection', operations: [{ kind: 'updateProps', nodeId: target.id, props: { html: '<script>alert(1)</script>' } }] })).toThrow();
    expect(() => applyAiProposal(document, { summary: 'URL dangereuse', operations: [{ kind: 'updateProps', nodeId: target.id, props: { ctaHref: 'javascript:alert(1)' } }] })).toThrow();
  });
});
