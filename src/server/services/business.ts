import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@/lib/id';
import { slugify } from '@/lib/utils';
import { getDb, type Db } from '@/server/db';
import { formSubmissions, orderItems, orders, posts, products, projectModules, projects, reservations } from '@/server/db/schema';
import { ApiError } from '@/server/http';
import { requireProject } from '@/server/auth/tenancy';

const moduleKeys = ['forms', 'blog', 'catalog', 'reservations'] as const;
const productInput = z.object({ name: z.string().trim().min(2).max(160), description: z.string().max(5000), priceCents: z.number().int().min(0).max(100_000_000), currency: z.enum(['EUR', 'USD', 'XOF']), inventory: z.number().int().min(0).max(1_000_000).nullable(), active: z.boolean() });
const postInput = z.object({ title: z.string().trim().min(2).max(200), excerpt: z.string().max(500), content: z.string().max(100_000), status: z.enum(['draft', 'published']) });

async function touchProject(projectId: string, workspaceId: string, db: Db) {
  await db.update(projects).set({ draftRevision: sql`${projects.draftRevision} + 1`, updatedAt: new Date() }).where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)));
}

export async function getBusinessData(userId: string, projectId: string, db?: Db) {
  const database = db ?? await getDb();
  const project = await requireProject(userId, projectId, 'read', database);
  type ScopedTable = typeof projectModules | typeof formSubmissions | typeof reservations | typeof orders | typeof products | typeof posts;
  const scope = (table: ScopedTable) => and(eq(table.projectId, project.id), eq(table.workspaceId, project.workspaceId));
  const [modules, messages, bookingList, orderList, catalog, journal] = await Promise.all([
    database.select().from(projectModules).where(scope(projectModules)).orderBy(projectModules.key),
    database.select().from(formSubmissions).where(scope(formSubmissions)).orderBy(desc(formSubmissions.createdAt)),
    database.select().from(reservations).where(scope(reservations)).orderBy(desc(reservations.createdAt)),
    database.select().from(orders).where(scope(orders)).orderBy(desc(orders.createdAt)),
    database.select().from(products).where(scope(products)).orderBy(desc(products.createdAt)),
    database.select().from(posts).where(scope(posts)).orderBy(desc(posts.createdAt)),
  ]);
  return { project, modules, messages, reservations: bookingList, orders: orderList, products: catalog, posts: journal };
}

export async function setModuleEnabled(userId: string, projectId: string, input: unknown, db?: Db) {
  const data = z.object({ key: z.enum(moduleKeys), enabled: z.boolean() }).parse(input);
  const database = db ?? await getDb();
  const project = await requireProject(userId, projectId, 'edit', database);
  const existing = (await database.select().from(projectModules).where(and(eq(projectModules.projectId, project.id), eq(projectModules.workspaceId, project.workspaceId), eq(projectModules.key, data.key))).limit(1))[0];
  if (existing) await database.update(projectModules).set({ enabled: data.enabled, updatedAt: new Date() }).where(and(eq(projectModules.id, existing.id), eq(projectModules.workspaceId, project.workspaceId)));
  else await database.insert(projectModules).values({ id: createId('module'), workspaceId: project.workspaceId, projectId: project.id, key: data.key, enabled: data.enabled });
  await touchProject(project.id, project.workspaceId, database);
}

export async function createProduct(userId: string, projectId: string, input: unknown, db?: Db) {
  const data = productInput.parse(input);
  const database = db ?? await getDb();
  const project = await requireProject(userId, projectId, 'edit', database);
  const id = createId('product');
  const product = (await database.insert(products).values({ id, workspaceId: project.workspaceId, projectId: project.id, name: data.name, slug: `${slugify(data.name)}-${id.slice(0, 5)}`, description: data.description, priceCents: data.priceCents, currency: data.currency, inventory: data.inventory, active: data.active }).returning())[0];
  await touchProject(project.id, project.workspaceId, database);
  return product;
}

export async function updateProduct(userId: string, projectId: string, productId: string, input: unknown, db?: Db) {
  const data = productInput.parse(input);
  const database = db ?? await getDb();
  const project = await requireProject(userId, projectId, 'edit', database);
  const updated = (await database.update(products).set({ name: data.name, description: data.description, priceCents: data.priceCents, currency: data.currency, inventory: data.inventory, active: data.active, updatedAt: new Date() }).where(and(eq(products.id, productId), eq(products.projectId, project.id), eq(products.workspaceId, project.workspaceId))).returning())[0];
  if (!updated) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Produit introuvable.');
  await touchProject(project.id, project.workspaceId, database);
  return updated;
}

export async function createPost(userId: string, projectId: string, input: unknown, db?: Db) {
  const data = postInput.parse(input);
  const database = db ?? await getDb();
  const project = await requireProject(userId, projectId, 'edit', database);
  const id = createId('post');
  const post = (await database.insert(posts).values({ id, workspaceId: project.workspaceId, projectId: project.id, title: data.title, slug: `${slugify(data.title)}-${id.slice(0, 5)}`, excerpt: data.excerpt, content: data.content, status: data.status, publishedAt: data.status === 'published' ? new Date() : null }).returning())[0];
  await touchProject(project.id, project.workspaceId, database);
  return post;
}

export async function updatePost(userId: string, projectId: string, postId: string, input: unknown, db?: Db) {
  const data = postInput.parse(input);
  const database = db ?? await getDb();
  const project = await requireProject(userId, projectId, 'edit', database);
  const current = (await database.select().from(posts).where(and(eq(posts.id, postId), eq(posts.projectId, project.id), eq(posts.workspaceId, project.workspaceId))).limit(1))[0];
  if (!current) throw new ApiError(404, 'POST_NOT_FOUND', 'Article introuvable.');
  const updated = (await database.update(posts).set({ title: data.title, excerpt: data.excerpt, content: data.content, status: data.status, publishedAt: data.status === 'published' ? current.publishedAt || new Date() : null, updatedAt: new Date() }).where(eq(posts.id, current.id)).returning())[0];
  await touchProject(project.id, project.workspaceId, database);
  return updated;
}

export async function updateMessageStatus(userId: string, projectId: string, recordId: string, input: unknown, db?: Db) {
  const status = z.enum(['new', 'read', 'archived']).parse(input);
  const database = db ?? await getDb();
  const project = await requireProject(userId, projectId, 'edit', database);
  const updated = (await database.update(formSubmissions).set({ status }).where(and(eq(formSubmissions.id, recordId), eq(formSubmissions.projectId, project.id), eq(formSubmissions.workspaceId, project.workspaceId))).returning())[0];
  if (!updated) throw new ApiError(404, 'MESSAGE_NOT_FOUND', 'Message introuvable.');
  return updated;
}

export async function updateReservationStatus(userId: string, projectId: string, recordId: string, input: unknown, db?: Db) {
  const status = z.enum(['pending', 'confirmed', 'cancelled']).parse(input);
  const database = db ?? await getDb();
  const project = await requireProject(userId, projectId, 'edit', database);
  const updated = (await database.update(reservations).set({ status, updatedAt: new Date() }).where(and(eq(reservations.id, recordId), eq(reservations.projectId, project.id), eq(reservations.workspaceId, project.workspaceId))).returning())[0];
  if (!updated) throw new ApiError(404, 'RESERVATION_NOT_FOUND', 'Réservation introuvable.');
  return updated;
}

export async function updateOrderStatus(userId: string, projectId: string, recordId: string, input: unknown, db?: Db) {
  const next = z.enum(['pending', 'confirmed', 'fulfilled', 'cancelled']).parse(input);
  const database = db ?? await getDb();
  const project = await requireProject(userId, projectId, 'edit', database);
  return database.transaction(async (tx) => {
    const current = (await tx.select().from(orders).where(and(eq(orders.id, recordId), eq(orders.projectId, project.id), eq(orders.workspaceId, project.workspaceId))).for('update').limit(1))[0];
    if (!current) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Commande introuvable.');
    const allowed: Record<string, string[]> = { pending: ['confirmed', 'cancelled'], confirmed: ['fulfilled', 'cancelled'], fulfilled: [], cancelled: [] };
    if (!allowed[current.status]?.includes(next)) throw new ApiError(409, 'ORDER_TRANSITION_INVALID', `Transition ${current.status} → ${next} non autorisée.`);
    if (next === 'cancelled') {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, current.id));
      for (const item of items) await tx.update(products).set({ inventory: sql`CASE WHEN ${products.inventory} IS NULL THEN NULL ELSE ${products.inventory} + ${item.quantity} END`, updatedAt: new Date() }).where(and(eq(products.id, item.productId), eq(products.workspaceId, project.workspaceId)));
    }
    return (await tx.update(orders).set({ status: next, updatedAt: new Date() }).where(eq(orders.id, current.id)).returning())[0];
  });
}
