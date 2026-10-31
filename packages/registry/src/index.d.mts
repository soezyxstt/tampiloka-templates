export interface Preset { name: string; description: string; url?: string; layout?: string; palette?: string; typography?: string; card?: string; button?: string }
export interface BookingPreset extends Preset { layout: string; palette: string; url: string }
export interface SchoolPreset extends BookingPreset { typography: string }
export interface Level { name: string; description: string; capabilities: string[] }
export interface Template { id: string; name: string; description: string; status: 'available' | 'planned'; directory: string; presets: Record<string,Preset>; levels?: Record<string,Level>; demoUrl?: string; defaultPreset?: string; defaultLevel?: string }
export const commerceFeatureIds: readonly string[];
export const commerceFeatureLabels: Record<string,string>;
export function commerceModulesFor(level: string, features?: string): Record<string,boolean>;
export const commerceLevels: Record<string,Level>;
export const commercePresets: Record<string,Preset>;
export const cafePresets: Record<string,Preset>;
export const bookingLevels: Record<string,Level>;
export const bookingPresets: Record<string,BookingPreset>;
export const bookingLayouts: readonly string[];
export const bookingPalettes: readonly string[];
export const schoolLevels: Record<string,Level>;
export const schoolPresets: Record<string,SchoolPreset>;
export const schoolLayouts: readonly string[];
export const schoolPalettes: readonly string[];
export const schoolTypography: readonly string[];
export const schoolModuleIds: readonly string[];
export function schoolModulesFor(level: string, features?: string): Record<string,boolean>;
export const schoolTemplate: Template;
export const templates: Template[];
export function getTemplate(id: string, options?: {availableOnly?: boolean}): Template;
export function capabilitiesFor(level: string): Record<string,boolean>;
