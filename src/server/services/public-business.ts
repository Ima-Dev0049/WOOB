import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@/lib/id';
import { walkNodes } from '@/lib/document/validation';
import { getDb, type Db } from '@/server/db';
import { formSubmissions, orderItems, orders, products, reservations } from '@/server/db/schema';
import { ApiError } from '@/server/http';
import { getPublishedProjectSite } from './publishing';

const identity = { name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(240) };
async function published(projectId: string, module: string, db: Db) {
  const site = await getPublishedProjectSite(projectId, db);
  if (!site) throw new ApiError(404, 'SITE_NOT_PUBLISHED', 'Ce site n’est pas disponible publiquement.');
  if (!site.modules.includes(module)) throw new ApiError(404, 'MODULE_UNAVAILABLE', 'Ce service n’est pas disponible sur ce site.');
  return site;
}

export async function submitPublicForm(input: unknown, db?: Db) {
  const data = z.object({ projectId: z.string().uuid(), formKey: z.string().regex(/^[a-z0-9-]+$/).max(80), ...identity, message: z.string().trim().min(5).max(5000), website: z.string().max(500).optional() }).parse(input);
  if (data.website) return { accepted: true };
  const database = db ?? await getDb();
  const site = await published(data.projectId, 'forms', database);
  const formExists = site.pages.some((page) => { let found = false; walkNodes(page.document.root, (node) => { if (node.type === 'contactForm' && node.props.formKey === data.formKey) found = true; }); return found; });
  if (!formExists) throw new ApiError(422, 'FORM_NOT_PUBLISHED', 'Ce formulaire n’appartient pas à la version publiée.');
  const project = await database.query.projects.findFirst({ where: (table, { eq }) => eq(table.id, data.projectId) });
  if (!project) throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Projet introuvable.');
  await database.insert(formSubmissions).values({ id: createId('submission'), workspaceId: project.workspaceId, projectId: data.projectId, formKey: data.formKey, name: data.name, email: data.email.toLowerCase(), message: data.message });
  return { accepted: true };
}

export async function submitReservation(input: unknown, db?: Db) {
  const data = z.object({ projectId: z.string().uuid(), serviceName: z.string().trim().min(1).max(200), ...identity, requestedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), partySize: z.number().int().min(1).max(20), notes: z.string().max(2000).optional() }).parse(input);
  const requested = new Date(`${data.requestedAt}:00Z`);
  if (Number.isNaN(requested.getTime()) || requested.getTime() < Date.now() - 86_400_000 || requested.getTime() > Date.now() + 366 * 86_400_000) throw new ApiError(422, 'RESERVATION_DATE_INVALID', 'Choisissez une date valide dans l’année à venir.');
  const database = db ?? await getDb();
  const site = await published(data.projectId, 'reservations', database);
  const serviceExists = site.pages.some((page) => { let found = false; walkNodes(page.document.root, (node) => { if (node.type === 'reservation' && node.props.serviceName === data.serviceName) found = true; }); return found; });
  if (!serviceExists) throw new ApiError(422, 'SERVICE_NOT_PUBLISHED', 'Ce service n’appartient pas à la version publiée.');
  const project = (await database.query.projects.findFirst({ where: (table, { eq }) => eq(table.id, data.projectId) }));
  if (!project) throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Projet introuvable.');
  const [date, time] = data.requestedAt.split('T');
  await database.insert(reservations).values({ id: createId('reservation'), workspaceId: project.workspaceId, projectId: data.projectId, customerName: data.name, customerEmail: data.email.toLowerCase(), serviceName: data.serviceName, reservationDate: date!, reservationTime: time!, partySize: data.partySize, notes: data.notes || '' });
  return { accepted: true, status: 'pending' };
}

export async function createManualOrder(input: unknown, db?: Db) {
  const data = z.object({ projectId: z.string().uuid(), customerName: identity.name, customerEmail: identity.email, items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(99) })).min(1).max(30) }).parse(input);
  const database = db ?? await getDb();
  await published(data.projectId, 'catalog', database);
  const quantities = new Map<string, number>();
  for (const item of data.items) quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
  const items = [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
  if (items.some((item) => item.quantity > 99)) throw new ApiError(422, 'CART_QUANTITY_INVALID', 'La quantité totale par produit ne peut pas dépasser 99.');
  return database.transaction(async (tx) => {
    const project = (await tx.query.projects.findFirst({ where: (table, { eq }) => eq(table.id, data.projectId) }));
    if (!project) throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Projet introuvable.');
    const ids = items.map((item) => item.productId);
    const catalog = await tx.select().from(products).where(and(eq(products.projectId, data.projectId), eq(products.workspaceId, project.workspaceId), eq(products.active, true), inArray(products.id, ids))).for('update');
    if (catalog.length !== ids.length) throw new ApiError(422, 'PRODUCT_UNAVAILABLE', 'Un produit n’est plus disponible.');
    const currency = catalog[0]?.currency || 'EUR';
    let total = 0;
    for (const item of items) {
      const product = catalog.find((candidate) => candidate.id === item.productId);
      if (!product || product.currency !== currency) throw new ApiError(422, 'CART_INVALID', 'Le panier contient des devises incompatibles.');
      if (product.inventory !== null && product.inventory < item.quantity) throw new ApiError(409, 'INVENTORY_INSUFFICIENT', `Stock insuffisant pour ${product.name}.`);
      total += product.priceCents * item.quantity;
    }
    if (!Number.isSafeInteger(total) || total < 0) throw new ApiError(422, 'ORDER_TOTAL_INVALID', 'Le total de la commande est invalide.');
    const orderId = createId('order');
    const reference = `WB-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${orderId.slice(0, 8).toUpperCase()}`;
    const order = (await tx.insert(orders).values({ id: orderId, workspaceId: project.workspaceId, projectId: data.projectId, reference, customerName: data.customerName, customerEmail: data.customerEmail.toLowerCase(), totalCents: total, currency, status: 'pending', paymentStatus: 'unpaid', paymentProvider: 'manual' }).returning())[0];
    if (!order) throw new Error('La commande n’a pas pu être créée.');
    for (const item of items) {
      const product = catalog.find((candidate) => candidate.id === item.productId)!;
      await tx.insert(orderItems).values({ id: createId('order_item'), orderId, productId: product.id, productName: product.name, unitPriceCents: product.priceCents, quantity: item.quantity });
      if (product.inventory !== null) await tx.update(products).set({ inventory: product.inventory - item.quantity, updatedAt: new Date() }).where(eq(products.id, product.id));
    }
    return order;
  });
}
