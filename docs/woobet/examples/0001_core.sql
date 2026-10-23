-- WOOBET — exemple de migration de spécification, non exécuté dans cette mission.
-- PostgreSQL. À revoir avec l'outil de migration et le rôle de déploiement retenus.
-- gen_random_uuid() est utilisé pour lisibilité ; UUIDv7 reste une décision de phase 0/1.

begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

create table users (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  email_normalized text not null unique,
  email_verified_at timestamptz,
  password_hash text,
  display_name text not null,
  ui_locale text not null default 'fr',
  timezone text not null default 'UTC',
  status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$'),
  owner_id uuid not null references users(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'deleting', 'deleted')),
  default_locale text not null default 'fr',
  timezone text not null default 'UTC',
  data_region text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'contributor', 'viewer')),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  invited_by uuid references users(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_status_idx
  on workspace_members (user_id, status) where status = 'active';

create table projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 160),
  slug text not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived', 'deleting', 'deleted')),
  created_by uuid references users(id) on delete set null,
  draft_revision bigint not null default 0 check (draft_revision >= 0),
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, id),
  unique (workspace_id, slug)
);
create index projects_workspace_updated_idx
  on projects (workspace_id, status, updated_at desc, id) where deleted_at is null;

create table pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  kind text not null default 'standard' check (kind in ('standard', 'home', 'not_found', 'system')),
  draft_document jsonb not null,
  draft_schema_version text not null,
  draft_revision bigint not null default 0 check (draft_revision >= 0),
  status text not null default 'draft' check (status in ('draft', 'ready', 'archived')),
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (workspace_id, project_id)
    references projects (workspace_id, id) on delete restrict,
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  check (jsonb_typeof(draft_document) = 'object')
);
create index pages_project_status_idx
  on pages (workspace_id, project_id, status) where deleted_at is null;

create table page_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  page_id uuid not null,
  number bigint not null check (number > 0),
  kind text not null check (kind in ('manual', 'autosave_checkpoint', 'pre_ai', 'pre_template', 'publish', 'restore')),
  schema_version text not null,
  document jsonb,
  document_uri text,
  checksum bytea not null,
  source_revision bigint not null,
  created_by uuid references users(id) on delete set null,
  comment text,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, project_id, page_id)
    references pages (workspace_id, project_id, id) on delete restrict,
  unique (workspace_id, page_id, number),
  check ((document is not null and document_uri is null)
      or (document is null and document_uri is not null))
);
create index page_versions_project_created_idx
  on page_versions (workspace_id, project_id, created_at desc, id);

create table publications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  number bigint not null check (number > 0),
  state text not null check (state in
    ('preparing', 'validating', 'building', 'ready', 'activating',
     'active', 'superseded', 'failed', 'cancelled')),
  source_revision bigint not null,
  manifest_uri text,
  manifest_checksum bytea,
  renderer_compatibility text,
  requested_by uuid references users(id) on delete set null,
  idempotency_key text not null,
  error_code text,
  error_details jsonb,
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  activated_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  foreign key (workspace_id, project_id)
    references projects (workspace_id, id) on delete restrict,
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  unique (workspace_id, project_id, number),
  unique (project_id, idempotency_key)
);
create index publications_project_state_idx
  on publications (workspace_id, project_id, state, created_at desc);

create table project_publication_pointers (
  workspace_id uuid not null,
  project_id uuid not null,
  publication_id uuid not null,
  previous_publication_id uuid,
  activated_by uuid references users(id) on delete set null,
  activation_kind text not null check (activation_kind in ('publish', 'rollback', 'recovery')),
  activated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0),
  primary key (workspace_id, project_id),
  foreign key (workspace_id, project_id)
    references projects (workspace_id, id) on delete cascade,
  foreign key (workspace_id, project_id, publication_id)
    references publications (workspace_id, project_id, id) on delete restrict
);

-- Fonction de contexte : l'app fixe app.workspace_id avec SET LOCAL après autorisation.
-- Le rôle runtime ne doit être ni propriétaire des tables, ni BYPASSRLS.
create or replace function app_current_workspace()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.workspace_id', true), '')::uuid;
$$;

alter table projects enable row level security;
alter table pages enable row level security;
alter table page_versions enable row level security;
alter table publications enable row level security;
alter table project_publication_pointers enable row level security;

create policy projects_tenant_policy on projects
  using (workspace_id = app_current_workspace())
  with check (workspace_id = app_current_workspace());
create policy pages_tenant_policy on pages
  using (workspace_id = app_current_workspace())
  with check (workspace_id = app_current_workspace());
create policy page_versions_tenant_policy on page_versions
  using (workspace_id = app_current_workspace())
  with check (workspace_id = app_current_workspace());
create policy publications_tenant_policy on publications
  using (workspace_id = app_current_workspace())
  with check (workspace_id = app_current_workspace());
create policy publication_pointer_tenant_policy on project_publication_pointers
  using (workspace_id = app_current_workspace())
  with check (workspace_id = app_current_workspace());

-- Exemple d'utilisation dans chaque cas d'usage (variables à paramétrer, jamais concaténer) :
-- begin;
-- select set_config('app.workspace_id', :'workspace_id', true); -- true = local à la transaction
-- update pages
--    set draft_document = :'draft_document'::jsonb,
--        draft_revision = draft_revision + 1,
--        updated_at = now()
--  where id = :'page_id'
--    and workspace_id = app_current_workspace()
--    and draft_revision = :'base_revision';
-- -- Vérifier exactement une ligne ; sinon 409/404 selon la politique.
-- commit;

commit;
