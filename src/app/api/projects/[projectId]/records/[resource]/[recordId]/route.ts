import { NextResponse } from 'next/server';
import { api, ApiError, noStore } from '@/server/http';
import { assertCsrf, requireUser } from '@/server/auth';
import { updateMessageStatus, updateOrderStatus, updateReservationStatus } from '@/server/services/business';
import { z } from 'zod';
export async function PATCH(request: Request, context: { params: Promise<{ projectId: string; resource: string; recordId: string }> }) {
  return api(async () => {
    const auth = await requireUser(); await assertCsrf(request);
    const { projectId, resource, recordId } = await context.params;
    const status = z.string().parse((await request.json()).status);
    if (resource === 'messages') return noStore(NextResponse.json({ record: await updateMessageStatus(auth.user.id, projectId, recordId, status) }));
    if (resource === 'reservations') return noStore(NextResponse.json({ record: await updateReservationStatus(auth.user.id, projectId, recordId, status) }));
    if (resource === 'orders') return noStore(NextResponse.json({ record: await updateOrderStatus(auth.user.id, projectId, recordId, status) }));
    throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Ressource introuvable.');
  });
}
