import { resolveObjectStorage } from '@tampiloka/storage';
import { authorized, decodeKey, imageType, MAX_MEDIA_BYTES, readLimited, upload } from '@/src/media/media.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const response = (message: string, status: number) => Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  try {
    if (!authorized(request.headers.get('authorization'), process.env)) return response('Unauthorized', 401);
    const length = Number(request.headers.get('content-length') || 0);
    if (length > MAX_MEDIA_BYTES) return response('Image too large', 413);
    const bytes = await readLimited(request.body);
    if (!bytes) return response('Image too large', 413);
    const token = await upload(resolveObjectStorage(process.env), bytes, process.env);
    if (!token) return response('Only JPEG, PNG and WebP images are supported', 415);
    return Response.json({ key: token, url: `/api/v1/media?key=${encodeURIComponent(token)}` }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { console.error('Media upload failed:', error); return response('Media service unavailable', 503); }
}

export async function GET(request: Request) {
  try {
    const key = decodeKey(new URL(request.url).searchParams.get('key'), process.env);
    if (!key) return response('Not found', 404);
    const object = await resolveObjectStorage(process.env).get(key);
    if (!object) return response('Not found', 404);
    const type = imageType(object.body);
    if (!type) return response('Not found', 404);
    return new Response(object.body as BodyInit, { headers: { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=300' } });
  } catch (error) { console.error('Media read failed:', error); return response('Media service unavailable', 503); }
}

export async function DELETE(request: Request) {
  try {
    if (!authorized(request.headers.get('authorization'), process.env)) return response('Unauthorized', 401);
    const key = decodeKey(new URL(request.url).searchParams.get('key'), process.env);
    if (!key) return response('Not found', 404);
    await resolveObjectStorage(process.env).delete(key);
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { console.error('Media deletion failed:', error); return response('Media service unavailable', 503); }
}
