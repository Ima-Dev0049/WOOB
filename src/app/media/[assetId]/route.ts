import { api } from '@/server/http';
import { getCurrentAuth } from '@/server/auth';
import { readAssetForUser } from '@/server/services/assets';

export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  return api(async () => {
    const auth = await getCurrentAuth();
    const { asset, data } = await readAssetForUser((await context.params).assetId, auth?.user.id || null);
    const inline = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(asset.mimeType);
    return new Response(new Uint8Array(data), { headers: {
      'Content-Type': asset.mimeType,
      'Content-Length': String(data.byteLength),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`,
      'Cache-Control': asset.visibility === 'public' ? 'public, max-age=3600' : 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    } });
  });
}
