export type LayoutId = 'editorial' | 'market' | 'atelier' | 'compact';
export type PaletteId = 'sand' | 'ink' | 'forest';
export type CardVariant = 'open' | 'framed' | 'soft';
export type ButtonVariant = 'solid' | 'outline';
export interface Appearance { layout: LayoutId; palette: PaletteId; card: CardVariant; button: ButtonVariant }
export interface BrandPalette { name: string; canvas: string; surface: string; text: string; muted: string; action: string; onAction: string; border: string; focus: string; accent: string }
export const layouts: Record<LayoutId, { name: string; description: string }>;
export const palettes: Record<PaletteId, BrandPalette>;
export const cardVariants: readonly CardVariant[];
export const buttonVariants: readonly ButtonVariant[];
export function resolveAppearance(input?: {layout?: string; palette?: string; card?: string; button?: string}): Appearance;
export function brandVariables(palette?: PaletteId, overrides?: Partial<BrandPalette>): Record<string,string>;
