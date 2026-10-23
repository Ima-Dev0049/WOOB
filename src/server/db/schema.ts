import {
  bigint,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { PageDocument, SiteSnapshot, ThemeSettings } from '@/lib/document/types';
import type { CatalogSelectionSnapshot } from '@/lib/catalog/types';
import type { ProjectBrief } from '@/lib/creative/types';

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  normalizedEmail: text('normalized_email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  uiLocale: text('ui_locale').notNull().default('fr'),
  timezone: text('timezone').notNull().default('UTC'),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  status: text('status').notNull().default('active'),
  platformRole: text('platform_role').notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const authTokens = pgTable(
  'auth_tokens',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    kind: text('kind').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('auth_tokens_user_kind_idx').on(table.userId, table.kind)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('sessions_user_active_idx').on(table.userId, table.revokedAt, table.expiresAt)],
);

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  defaultLocale: text('default_locale').notNull().default('fr'),
  timezone: text('timezone').notNull().default('UTC'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('owner'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    index('workspace_members_user_idx').on(table.userId, table.status),
  ],
);

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey(),
  code: text('code').notNull(),
  version: integer('version').notNull().default(1),
  name: text('name').notNull(),
  description: text('description').notNull(),
  monthlyPriceCents: integer('monthly_price_cents'),
  currency: text('currency').notNull().default('EUR'),
  features: jsonb('features').$type<Record<string, number | boolean>>().notNull(),
  stripePriceId: text('stripe_price_id'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex('plans_code_version_unique').on(table.code, table.version)]);

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  planId: uuid('plan_id').notNull().references(() => plans.id),
  provider: text('provider').notNull().default('local'),
  providerCustomerId: text('provider_customer_id'),
  providerSubscriptionId: text('provider_subscription_id'),
  status: text('status').notNull().default('active'),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('subscriptions_workspace_unique').on(table.workspaceId),
  uniqueIndex('subscriptions_provider_id_unique').on(table.providerSubscriptionId),
]);

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  status: text('status').notNull().default('draft'),
  activePublicationId: uuid('active_publication_id'),
  draftRevision: integer('draft_revision').notNull().default(0),
  theme: jsonb('theme').$type<ThemeSettings>().notNull(),
  defaultLocale: text('default_locale').notNull().default('fr'),
  catalogSelection: jsonb('catalog_selection').$type<CatalogSelectionSnapshot | null>(),
  creativeBrief: jsonb('creative_brief').$type<ProjectBrief | null>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  unique('projects_workspace_id_unique').on(table.workspaceId, table.id),
  index('projects_workspace_updated_idx').on(table.workspaceId, table.updatedAt),
]);

export const pages = pgTable('pages', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),
  projectId: uuid('project_id').notNull(),
  name: text('name').notNull(),
  path: text('path').notNull(),
  kind: text('kind').notNull().default('standard'),
  draftDocument: jsonb('draft_document').$type<PageDocument>().notNull(),
  draftRevision: integer('draft_revision').notNull().default(0),
  seoTitle: text('seo_title').notNull().default(''),
  seoDescription: text('seo_description').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.workspaceId, table.projectId],
    foreignColumns: [projects.workspaceId, projects.id],
    name: 'pages_project_tenant_fk',
  }).onDelete('cascade'),
  unique('pages_workspace_project_id_unique').on(table.workspaceId, table.projectId, table.id),
  uniqueIndex('pages_project_path_unique').on(table.projectId, table.path),
  index('pages_project_updated_idx').on(table.projectId, table.updatedAt),
]);

export const pageVersions = pgTable('page_versions', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),
  projectId: uuid('project_id').notNull(),
  pageId: uuid('page_id').notNull(),
  versionNumber: integer('version_number').notNull(),
  kind: text('kind').notNull(),
  document: jsonb('document').$type<PageDocument>().notNull(),
  sourceRevision: integer('source_revision').notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.workspaceId, table.projectId, table.pageId],
    foreignColumns: [pages.workspaceId, pages.projectId, pages.id],
    name: 'page_versions_page_tenant_fk',
  }).onDelete('cascade'),
  uniqueIndex('page_versions_page_number_unique').on(table.pageId, table.versionNumber),
]);

export const publications = pgTable('publications', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),
  projectId: uuid('project_id').notNull(),
  number: integer('number').notNull(),
  state: text('state').notNull(),
  snapshot: jsonb('snapshot').$type<SiteSnapshot>().notNull(),
  sourceRevision: integer('source_revision').notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
}, (table) => [
  foreignKey({
    columns: [table.workspaceId, table.projectId],
    foreignColumns: [projects.workspaceId, projects.id],
    name: 'publications_project_tenant_fk',
  }).onDelete('cascade'),
  uniqueIndex('publications_project_number_unique').on(table.projectId, table.number),
  index('publications_project_state_idx').on(table.projectId, table.state, table.createdAt),
]);

export const domains = pgTable('domains', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),
  projectId: uuid('project_id').notNull(),
  hostname: text('hostname').notNull(),
  asciiHostname: text('ascii_hostname').notNull().unique(),
  kind: text('kind').notNull(),
  state: text('state').notNull(),
  verificationRecordName: text('verification_record_name'),
  verificationTokenHash: text('verification_token_hash'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.workspaceId, table.projectId],
    foreignColumns: [projects.workspaceId, projects.id],
    name: 'domains_project_tenant_fk',
  }).onDelete('cascade'),
]);

export const assets = pgTable('assets', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),
  projectId: uuid('project_id'),
  fileName: text('file_name').notNull(),
  storageKey: text('storage_key').notNull().unique(),
  mimeType: text('mime_type').notNull(),
  byteSize: integer('byte_size').notNull(),
  alt: text('alt').notNull().default(''),
  visibility: text('visibility').notNull().default('private'),
  checksum: text('checksum').notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  foreignKey({
    columns: [table.workspaceId, table.projectId],
    foreignColumns: [projects.workspaceId, projects.id],
    name: 'assets_project_tenant_fk',
  }).onDelete('cascade'),
  index('assets_workspace_project_idx').on(table.workspaceId, table.projectId, table.deletedAt),
]);

export const aiGenerations = pgTable('ai_generations', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),
  projectId: uuid('project_id'),
  requestedBy: uuid('requested_by').notNull().references(() => users.id),
  kind: text('kind').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  state: text('state').notNull(),
  prompt: text('prompt').notNull(),
  output: jsonb('output').$type<unknown>(),
  errorCode: text('error_code'),
  inputUnits: integer('input_units').notNull().default(0),
  outputUnits: integer('output_units').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [
  foreignKey({
    columns: [table.workspaceId, table.projectId],
    foreignColumns: [projects.workspaceId, projects.id],
    name: 'ai_generations_project_tenant_fk',
  }).onDelete('cascade'),
  index('ai_generations_workspace_created_idx').on(table.workspaceId, table.createdAt),
]);

export const usageRecords = pgTable('usage_records', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  metric: text('metric').notNull(),
  quantity: bigint('quantity', { mode: 'number' }).notNull(),
  referenceId: text('reference_id'),
  period: text('period').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('usage_records_reference_unique').on(table.metric, table.referenceId),
  index('usage_records_workspace_period_idx').on(table.workspaceId, table.metric, table.period),
]);

export const projectModules = pgTable('project_modules', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),
  projectId: uuid('project_id').notNull(),
  key: text('key').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.workspaceId, table.projectId],
    foreignColumns: [projects.workspaceId, projects.id],
    name: 'project_modules_project_tenant_fk',
  }).onDelete('cascade'),
  uniqueIndex('project_modules_project_key_unique').on(table.projectId, table.key),
]);

export const formSubmissions = pgTable('form_submissions', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),
  projectId: uuid('project_id').notNull(),
  formKey: text('form_key').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('new'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.workspaceId, table.projectId],
    foreignColumns: [projects.workspaceId, projects.id],
    name: 'form_submissions_project_tenant_fk',
  }).onDelete('cascade'),
  index('form_submissions_project_created_idx').on(table.projectId, table.createdAt),
]);

export const products = pgTable('products', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),
  projectId: uuid('project_id').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description').notNull().default(''),
  priceCents: integer('price_cents').notNull(),
  currency: text('currency').notNull().default('EUR'),
  imageAssetId: uuid('image_asset_id'),
  inventory: integer('inventory'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.workspaceId, table.projectId],
    foreignColumns: [projects.workspaceId, projects.id],
    name: 'products_project_tenant_fk',
  }).onDelete('cascade'),
  uniqueIndex('products_project_slug_unique').on(table.projectId, table.slug),
]);

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),
  projectId: uuid('project_id').notNull(),
  reference: text('reference').notNull().unique(),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  status: text('status').notNull().default('pending'),
  paymentStatus: text('payment_status').notNull().default('unpaid'),
  paymentProvider: text('payment_provider').notNull().default('manual'),
  totalCents: integer('total_cents').notNull(),
  currency: text('currency').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.workspaceId, table.projectId],
    foreignColumns: [projects.workspaceId, projects.id],
    name: 'orders_project_tenant_fk',
  }).onDelete('cascade'),
  index('orders_project_created_idx').on(table.projectId, table.createdAt),
]);

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  productName: text('product_name').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
  quantity: integer('quantity').notNull(),
});

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),
  projectId: uuid('project_id').notNull(),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  excerpt: text('excerpt').notNull().default(''),
  content: text('content').notNull().default(''),
  status: text('status').notNull().default('draft'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.workspaceId, table.projectId],
    foreignColumns: [projects.workspaceId, projects.id],
    name: 'posts_project_tenant_fk',
  }).onDelete('cascade'),
  uniqueIndex('posts_project_slug_unique').on(table.projectId, table.slug),
]);

export const reservations = pgTable('reservations', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),
  projectId: uuid('project_id').notNull(),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  serviceName: text('service_name').notNull(),
  reservationDate: text('reservation_date').notNull(),
  reservationTime: text('reservation_time').notNull(),
  partySize: integer('party_size').notNull(),
  notes: text('notes').notNull().default(''),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.workspaceId, table.projectId],
    foreignColumns: [projects.workspaceId, projects.id],
    name: 'reservations_project_tenant_fk',
  }).onDelete('cascade'),
  index('reservations_project_slot_idx').on(table.projectId, table.reservationDate, table.reservationTime),
]);

export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: uuid('id').primaryKey(),
  actorUserId: uuid('actor_user_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: uuid('target_id').notNull(),
  details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('admin_audit_actor_created_idx').on(table.actorUserId, table.createdAt),
  index('admin_audit_target_created_idx').on(table.targetType, table.targetId, table.createdAt),
]);

export const processedEvents = pgTable('processed_events', {
  id: uuid('id').primaryKey(),
  provider: text('provider').notNull(),
  providerEventId: text('provider_event_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex('processed_events_provider_unique').on(table.provider, table.providerEventId)]);

export type User = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type Publication = typeof publications.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type ProjectModule = typeof projectModules.$inferSelect;
export type FormSubmission = typeof formSubmissions.$inferSelect;
export type Reservation = typeof reservations.$inferSelect;
export type Order = typeof orders.$inferSelect;
