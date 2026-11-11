import { resolveDatabase } from '@tampiloka/storage';
import { handle, cleanup, dispatchNotifications, type Env } from './api.ts';

type Bindings = Omit<Env, 'DB'> & { DB?: Env['DB'] };

export default {
    async fetch(request: Request, bindings: Bindings, ctx: { waitUntil(promise: Promise<unknown>): void }) {
        if (new URL(request.url).pathname.startsWith('/api/')) {
            let db: Env['DB'];
            try { db = resolveDatabase(bindings) as Env['DB']; }
            catch { return Response.json({ error: 'storage_not_configured' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
            return handle(request, { ...bindings, DB: db }, ctx);
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
        const env = { ...bindings, DB: resolveDatabase(bindings) as Env['DB'] };
        await cleanup(env);
        await dispatchNotifications(env);
    },
};
