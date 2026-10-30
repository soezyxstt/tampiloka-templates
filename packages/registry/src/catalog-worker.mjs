/** Kept dependency-free so a catalog update does not build either demo or marketing app. */
export function createCatalogWorker(body, etag) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=120',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'If-None-Match',
    'Access-Control-Expose-Headers': 'ETag',
    'X-Content-Type-Options': 'nosniff',
    'ETag': etag,
  };
  return {
    async fetch(request) {
      const { pathname } = new URL(request.url);
      if (pathname !== '/' && pathname !== '/catalog.v1.json') return new Response('Not found', { status: 404 });
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD, OPTIONS', 'Cache-Control': 'no-store' } });
      const matches = request.headers.get('If-None-Match')?.split(',').map(value => value.trim());
      if (matches?.some(value => value === etag || value === `W/${etag}` || value === '*')) return new Response(null, { status: 304, headers });
      return new Response(request.method === 'HEAD' ? null : body, { headers });
    },
  };
}
