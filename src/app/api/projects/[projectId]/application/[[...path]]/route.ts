import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCsrf, requireUser } from '@/server/auth';
import { api, ApiError, noStore } from '@/server/http';
import {
  createApplicationRecord,
  deleteApplicationRecord,
  executeApplicationAction,
  getApplicationModel,
  getApplicationRecord,
  getApplicationSummary,
  listApplicationRecords,
  saveApplicationModel,
  updateApplicationRecord,
} from '@/server/services/application';

type RouteContext = { params: Promise<{ projectId: string; path?: string[] }> };
const recordBodySchema = z.object({ data: z.record(z.string(), z.unknown()) });

function notFound(): never {
  throw new ApiError(404, 'APPLICATION_ROUTE_NOT_FOUND', 'Cette opération n’est pas déduite du modèle applicatif.');
}

function listOptions(request: Request) {
  const params = new URL(request.url).searchParams;
  const numberParam = (key: string) => params.has(key) ? Number(params.get(key)) : undefined;
  const ids = params.getAll('id');
  return { q: params.get('q') || undefined, status: params.get('status') || undefined, ids: ids.length ? ids : undefined, limit: numberParam('limit'), offset: numberParam('offset') };
}

export async function GET(request: Request, context: RouteContext) {
  return api(async () => {
    const auth = await requireUser();
    const { projectId, path = [] } = await context.params;
    if (!path.length) return noStore(NextResponse.json(await getApplicationModel(auth.user.id, projectId)));
    if (path.length === 1 && path[0] === 'summary') return noStore(NextResponse.json(await getApplicationSummary(auth.user.id, projectId)));
    if (path[0] !== 'objects') notFound();
    if (path.length === 2) return noStore(NextResponse.json(await listApplicationRecords(auth.user.id, projectId, path[1]!, listOptions(request))));
    if (path.length === 3) return noStore(NextResponse.json({ record: await getApplicationRecord(auth.user.id, projectId, path[1]!, path[2]!) }));
    notFound();
  });
}

export async function PUT(request: Request, context: RouteContext) {
  return api(async () => {
    const auth = await requireUser();
    await assertCsrf(request);
    const { projectId, path = [] } = await context.params;
    if (path.length) notFound();
    const model = await saveApplicationModel(auth.user.id, projectId, await request.json());
    return noStore(NextResponse.json({ model: model.model, version: model.version, routes: (await getApplicationModel(auth.user.id, projectId)).routes }));
  });
}

export async function POST(request: Request, context: RouteContext) {
  return api(async () => {
    const auth = await requireUser();
    await assertCsrf(request);
    const { projectId, path = [] } = await context.params;
    if (path[0] !== 'objects') notFound();
    if (path.length === 2) {
      const body = recordBodySchema.parse(await request.json());
      const record = await createApplicationRecord(auth.user.id, projectId, path[1]!, body.data);
      return noStore(NextResponse.json({ record }, { status: 201 }));
    }
    if (path.length === 5 && path[3] === 'actions') {
      const record = await executeApplicationAction(auth.user.id, projectId, path[1]!, path[2]!, path[4]!);
      return noStore(NextResponse.json({ record }));
    }
    notFound();
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return api(async () => {
    const auth = await requireUser();
    await assertCsrf(request);
    const { projectId, path = [] } = await context.params;
    if (path[0] !== 'objects' || path.length !== 3) notFound();
    const body = recordBodySchema.parse(await request.json());
    const record = await updateApplicationRecord(auth.user.id, projectId, path[1]!, path[2]!, body.data);
    return noStore(NextResponse.json({ record }));
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  return api(async () => {
    const auth = await requireUser();
    await assertCsrf(request);
    const { projectId, path = [] } = await context.params;
    if (path[0] !== 'objects' || path.length !== 3) notFound();
    return noStore(NextResponse.json(await deleteApplicationRecord(auth.user.id, projectId, path[1]!, path[2]!)));
  });
}
