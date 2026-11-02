import { createTursoDatabase } from '@tampiloka/shared-utils/turso';
import { handle, cleanup, dispatchNotifications, type Env } from './api.ts';

type Bindings = Omit<Env, 'DB'> & { TURSO_DATABASE_URL?: string; TURSO_AUTH_TOKEN?: string };

export default {
    async fetch(request: Request, bindings: Bindings, ctx: { waitUntil(promise: Promise<unknown>): void }) {
        if (new URL(request.url).pathname.startsWith('/api/')) {
            if (!bindings.TURSO_DATABASE_URL || !bindings.TURSO_AUTH_TOKEN)
                return Response.json({ error: 'storage_not_configured' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
            return handle(request, { ...bindings, DB: createTursoDatabase(bindings) }, ctx);
        }
        const r = await bindings.ASSETS?.fetch(request);
        if (!r) return new Response('Build static assets first.', { status: 503 });
        const response = new Response(r.body, r);
        response.headers.set('X-Content-Type-Options', 'nosniff');
        response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
        response.headers.set('X-Frame-Options', 'SAMEORIGIN');
        if (bindings.DEMO_MODE === 'true') response.headers.set('X-Robots-Tag', 'noindex, nofollow');
        return response;
    },
    async scheduled(_event: unknown, bindings: Bindings) {
        const env = { ...bindings, DB: createTursoDatabase(bindings) };
        await cleanup(env);
        await dispatchNotifications(env);
    },
};
