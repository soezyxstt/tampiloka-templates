import config from '../../config/operations.json';
export const themes = ['sand', 'forest', 'ink'] as const;
export const modes = ['inventory', 'retail', 'full'] as const;
export const presets = ['food', 'retail', 'supplies'] as const;
export const personas = ['owner', 'inventory', 'receiver', 'cashier', 'pricing', 'auditor', 'mixed'] as const;
export const pages = ['dashboard', 'stock', 'shipments', 'receiving', 'cashier', 'pricing', 'counts', 'returns', 'shifts', 'reports', 'audit', 'masters', 'access', 'settings', 'data'] as const;
export type Page = typeof pages[number];
export interface Route { theme: typeof themes[number]; mode: typeof modes[number]; preset: typeof presets[number]; view: typeof personas[number]; lang: 'id'|'en'; page: Page; location: string; document: string }
function pick<T extends string>(value: string | null, values: readonly T[], fallback: T): T { return values.includes(value as T) ? value as T : fallback; }
export function readRoute(url = new URL(location.href)): Route {
  const p = url.searchParams;
  let saved = 'id'; try { saved = localStorage.getItem('tl-operations-language') || 'id'; } catch { /* Storage can be blocked. */ }
  const mode=pick(p.get('mode'),modes,pick(config.mode,modes,'full'));const wantedView=pick(p.get('view'),personas,'owner');
  return { theme: pick(p.get('theme'), themes, pick(config.theme, themes, 'sand')), mode: pick(p.get('mode'), modes, pick(config.mode, modes, 'full')), preset: pick(p.get('preset'), presets, pick(config.preset, presets, 'food')), view: mode==='inventory'&&['cashier','pricing','mixed'].includes(wantedView)?'owner':wantedView, lang: pick(p.get('lang'), ['id','en'], saved === 'en' ? 'en':'id'), page: pick(p.get('page'), pages, 'dashboard'), location: p.get('location') || '', document: p.get('document') || '' };
}
export function routeUrl(patch: Partial<Route>): string { const url = new URL(location.href); Object.entries(patch).forEach(([key,value]) => value ? url.searchParams.set(key,value) : url.searchParams.delete(key)); return url.pathname + url.search + url.hash; }
