/** Composition owns geometry. Brand identity owns color, font and assets. */
export const layouts = Object.freeze({
  editorial: { name: 'Editorial', description: 'Foto pembuka, cerita singkat, dan koleksi terbuka.' },
  market: { name: 'Market', description: 'Kategori tetap terlihat, pencarian utama, dan grid padat.' },
  atelier: { name: 'Atelier', description: 'Koleksi visual dengan ukuran gambar yang beragam.' },
  compact: { name: 'Compact', description: 'Daftar produk dan pembelian cepat dalam satu baris.' },
});
/**
 * Warm, low-glare palettes for shopping and food ordering. Every pair below is
 * checked against AGENTS.md: text/muted >= 4.5:1 on canvas and surface,
 * onAction >= 4.5:1 on action, accent >= 4.5:1 on canvas, focus >= 3:1.
 * IDs are a public config contract; change values, never rename IDs.
 */
export const palettes = Object.freeze({
  sand: { name: 'Sand', canvas: '#f7f5f1', surface: '#ffffff', text: '#2a2420', muted: '#6b635b', action: '#2a2420', onAction: '#ffffff', border: '#e3ddd5', focus: '#9a5a3a', accent: '#a4492a' },
  ink: { name: 'Ink', canvas: '#f6f6f6', surface: '#ffffff', text: '#1c1c1e', muted: '#5e5e66', action: '#1c1c1e', onAction: '#ffffff', border: '#e0e0e3', focus: '#4a5578', accent: '#a4492a' },
  forest: { name: 'Forest', canvas: '#f3f6f2', surface: '#ffffff', text: '#1a2e23', muted: '#55675b', action: '#245a40', onAction: '#ffffff', border: '#d5dfd5', focus: '#2f7a55', accent: '#8a5a1f' },
});
export const cardVariants = Object.freeze(['open', 'framed', 'soft']);
export const buttonVariants = Object.freeze(['solid', 'outline']);
export function resolveAppearance(input = {}) {
  return {
    layout: Object.hasOwn(layouts, input.layout) ? input.layout : 'editorial',
    palette: Object.hasOwn(palettes, input.palette) ? input.palette : 'sand',
    card: cardVariants.includes(input.card) ? input.card : 'open',
    button: buttonVariants.includes(input.button) ? input.button : 'solid',
  };
}
export function brandVariables(palette = 'sand', overrides = {}) {
  const source = { ...(palettes[palette] || palettes.sand), ...overrides };
  return Object.fromEntries(['canvas','surface','text','muted','action','onAction','border','focus','accent'].map(key => [
    `--brand-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`, source[key],
  ]));
}
