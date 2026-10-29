/** Composition owns geometry. Brand identity owns color, font and assets. */
export const layouts = Object.freeze({
  editorial: { name: 'Editorial', description: 'Foto pembuka, cerita singkat, dan koleksi terbuka.' },
  market: { name: 'Market', description: 'Kategori tetap terlihat, pencarian utama, dan grid padat.' },
  atelier: { name: 'Atelier', description: 'Koleksi visual dengan ukuran gambar yang beragam.' },
  compact: { name: 'Compact', description: 'Daftar produk dan pembelian cepat dalam satu baris.' },
});
export const palettes = Object.freeze({
  sand: { name: 'Sand', canvas: '#f7f5f0', surface: '#ffffff', text: '#242820', muted: '#62665c', action: '#344c3a', onAction: '#ffffff', border: '#dedfd5', focus: '#4e6b4d' },
  ink: { name: 'Ink', canvas: '#f7f7f7', surface: '#ffffff', text: '#202124', muted: '#60636b', action: '#202124', onAction: '#ffffff', border: '#dedfe3', focus: '#4c5883' },
  forest: { name: 'Forest', canvas: '#f1f4ef', surface: '#ffffff', text: '#1e3428', muted: '#586b5d', action: '#23553b', onAction: '#ffffff', border: '#d2ddd0', focus: '#317b54' },
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
  return Object.fromEntries(['canvas','surface','text','muted','action','onAction','border','focus'].map(key => [
    `--brand-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`, source[key],
  ]));
}
