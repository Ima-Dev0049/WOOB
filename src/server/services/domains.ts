import { resolveTxt } from 'node:dns/promises';
import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@/lib/id';
import { getDb, type Db } from '@/server/db';
import { domains } from '@/server/db/schema';
import { ApiError } from '@/server/http';
import { requireProject } from '@/server/auth/tenancy';
import { assertDomainQuota } from './quotas';
import { createToken, hashToken, safeEqual } from '@/server/security/crypto';

type DomainRow = typeof domains.$inferSelect;
export type DomainDto = Pick<DomainRow, 'id' | 'hostname' | 'asciiHostname' | 'state' | 'verificationRecordName' | 'lastError' | 'createdAt'>;

function toDomainDto(domain: DomainRow): DomainDto {
  return {
    id: domain.id,
    hostname: domain.hostname,
    asciiHostname: domain.asciiHostname,
    state: domain.state,
    verificationRecordName: domain.verificationRecordName,
    lastError: domain.lastError,
    createdAt: domain.createdAt,
  };
}

function normalizeHostname(input: unknown): string {
  const raw = z.string().trim().max(300).parse(input).toLowerCase().replace(/\.$/, '');
  if (!raw || /[\s/\\@:?#[\]]/.test(raw)) {
    throw new ApiError(422, 'HOSTNAME_INVALID', 'Saisissez un nom de domaine DNS valide, sans protocole, port ni chemin.');
  }
  const ascii = domainToASCII(raw);
  const labels = ascii.split('.');
  if (!ascii || ascii.length > 253 || labels.length < 2 || isIP(ascii) || labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new ApiError(422, 'HOSTNAME_INVALID', 'Saisissez un nom de domaine DNS valide, sans protocole, port ni chemin.');
  }
  return ascii;
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  while (typeof current === 'object' && current !== null) {
    if ('code' in current && current.code === '23505') return true;
    if (!('cause' in current)) return false;
    current = current.cause;
  }
  return false;
}

export async function listDomains(userId: string, projectId: string, db?: Db) {
  const database = db ?? await getDb();
  const project = await requireProject(userId, projectId, 'read', database);
  return database.select({ id: domains.id, hostname: domains.hostname, asciiHostname: domains.asciiHostname, state: domains.state, verificationRecordName: domains.verificationRecordName, lastError: domains.lastError, createdAt: domains.createdAt }).from(domains).where(and(eq(domains.projectId, project.id), eq(domains.workspaceId, project.workspaceId))).orderBy(asc(domains.createdAt));
}

export async function addDomain(userId: string, projectId: string, input: unknown, db?: Db) {
  const database = db ?? await getDb();
  const project = await requireProject(userId, projectId, 'domains', database);
  await assertDomainQuota(project.workspaceId, database);
  const hostname = normalizeHostname((z.object({ hostname: z.unknown() }).parse(input)).hostname);
  const token = createToken(24);
  const recordName = `_woob.${hostname}`;
  let domain: DomainRow | undefined;
  try {
    domain = (await database.insert(domains).values({
      id: createId('domain'),
      workspaceId: project.workspaceId,
      projectId: project.id,
      hostname,
      asciiHostname: hostname,
      kind: 'custom',
      state: 'pending_dns',
      verificationRecordName: recordName,
      verificationTokenHash: hashToken(token),
    }).returning())[0];
  } catch (error) {
    if (isUniqueViolation(error)) throw new ApiError(409, 'DOMAIN_ALREADY_EXISTS', 'Ce nom de domaine est déjà enregistré dans Woob.');
    throw error;
  }
  if (!domain) throw new ApiError(500, 'DOMAIN_CREATE_FAILED', 'Le domaine n’a pas pu être enregistré.');
  return {
    domain: toDomainDto(domain),
    verification: { type: 'TXT', name: recordName, value: `woob-verify=${token}` },
    notice: 'Enregistrement créé dans Woob uniquement. Ajoutez ce TXT chez votre DNS ; aucun certificat ni routage n’est actif.',
  };
}

async function rejectUnverifiedDomain(database: Db, domain: DomainRow): Promise<never> {
  await database.update(domains).set({ state: 'pending_dns', lastError: 'Le TXT Woob n’a pas été trouvé. Vérifiez la propagation DNS.', updatedAt: new Date() }).where(and(eq(domains.id, domain.id), eq(domains.workspaceId, domain.workspaceId)));
  throw new ApiError(409, 'DNS_NOT_VERIFIED', 'Le TXT Woob n’a pas été trouvé. Aucun domaine actif n’a été déclaré.');
}

export async function verifyDomain(userId: string, domainId: string, db?: Db) {
  const database = db ?? await getDb();
  const domain = (await database.select().from(domains).where(eq(domains.id, domainId)).limit(1))[0];
  if (!domain) throw new ApiError(404, 'DOMAIN_NOT_FOUND', 'Domaine introuvable.');
  await requireProject(userId, domain.projectId, 'domains', database);
  if (process.env.DNS_VERIFICATION_ENABLED !== 'true') throw new ApiError(503, 'DNS_VERIFICATION_UNAVAILABLE', 'La vérification DNS distante n’est pas activée sur cette installation. Le domaine reste en attente ; aucun état actif n’est simulé.');
  if (!domain.verificationRecordName || !domain.verificationTokenHash) throw new ApiError(409, 'VERIFICATION_TOKEN_MISSING', 'Le jeton de vérification est absent.');

  let records: string[][];
  try {
    records = await resolveTxt(domain.verificationRecordName);
  } catch {
    return rejectUnverifiedDomain(database, domain);
  }
  const match = records.flat().some((value) => value.startsWith('woob-verify=') && safeEqual(hashToken(value.slice('woob-verify='.length)), domain.verificationTokenHash!));
  if (!match) return rejectUnverifiedDomain(database, domain);

  const updated = (await database.update(domains).set({
    state: 'dns_verified',
    lastError: 'DNS vérifié. Routage et certificat TLS toujours requis par la plateforme.',
    updatedAt: new Date(),
  }).where(and(eq(domains.id, domain.id), eq(domains.workspaceId, domain.workspaceId))).returning())[0];
  if (!updated) throw new ApiError(404, 'DOMAIN_NOT_FOUND', 'Domaine introuvable.');
  return toDomainDto(updated);
}

export async function deleteDomain(userId: string, domainId: string, db?: Db) {
  const database = db ?? await getDb();
  const domain = (await database.select().from(domains).where(eq(domains.id, domainId)).limit(1))[0];
  if (!domain) throw new ApiError(404, 'DOMAIN_NOT_FOUND', 'Domaine introuvable.');
  await requireProject(userId, domain.projectId, 'domains', database);
  await database.delete(domains).where(and(eq(domains.id, domain.id), eq(domains.workspaceId, domain.workspaceId)));
}
