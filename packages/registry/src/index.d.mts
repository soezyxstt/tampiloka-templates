export interface Preset { name: string; description: string; url?: string; layout?: string; palette?: string; card?: string; button?: string }
export interface Level { name: string; description: string; capabilities: string[] }
export interface Template { id: string; name: string; description: string; status: 'available' | 'planned'; directory: string; presets: Record<string,Preset>; levels?: Record<string,Level>; demoUrl?: string; defaultPreset?: string; defaultLevel?: string }
export const commerceFeatureIds: readonly string[];
export const commerceFeatureLabels: Record<string,string>;
export function commerceModulesFor(level: string, features?: string): Record<string,boolean>;
export const commerceLevels: Record<string,Level>;
export const commercePresets: Record<string,Preset>;
export const cafePresets: Record<string,Preset>;
export const templates: Template[];
export function getTemplate(id: string, options?: {availableOnly?: boolean}): Template;
export function capabilitiesFor(level: string): Record<string,boolean>;
