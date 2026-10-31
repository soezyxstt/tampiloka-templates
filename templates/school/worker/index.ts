import { handle, cleanup, dispatchNotifications, type Env } from './api.ts';
export default { async fetch(request: Request, env: Env, ctx: {
        waitUntil(promise: Promise<unknown>): void;
    }) { if (new URL(request.url).pathname.startsWith('/api/'))
        return handle(request, env, ctx); const r = await env.ASSETS?.fetch(request); if (!r)
        return new Response('Build static assets first.', { status: 503 }); const response = new Response(r.body, r); response.headers.set('X-Content-Type-Options', 'nosniff'); response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin'); response.headers.set('X-Frame-Options', 'SAMEORIGIN'); if (env.DEMO_MODE === 'true')
        response.headers.set('X-Robots-Tag', 'noindex, nofollow'); return response; }, async scheduled(_event: unknown, env: Env) { await cleanup(env); await dispatchNotifications(env); } };
