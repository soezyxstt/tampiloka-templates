import { resolveAppearance } from '@tampiloka/theme-engine';
export const presets = [
  { id: 'editorial', name: 'Editorial', description: 'Cerita koleksi dan foto besar.', card: 'open', button: 'solid' },
  { id: 'market', name: 'Market', description: 'Kategori dan produk yang padat.', card: 'framed', button: 'solid' },
  { id: 'atelier', name: 'Atelier', description: 'Galeri dengan ukuran foto beragam.', card: 'open', button: 'outline' },
  { id: 'compact', name: 'Compact', description: 'Daftar produk untuk belanja cepat.', card: 'soft', button: 'solid' },
] as const;
export type PresetId = typeof presets[number]['id'];
export interface Appearance { palette: 'sand' | 'ink' | 'forest'; card: 'open' | 'framed' | 'soft'; button: 'solid' | 'outline' }
export const defaultAppearance: Appearance = { palette: 'sand', card: 'open', button: 'solid' };
export function readAppearance(): Appearance { try { return resolveAppearance(JSON.parse(localStorage.getItem('tampiloka-commerce-appearance') || '{}')); } catch { return defaultAppearance; } }
