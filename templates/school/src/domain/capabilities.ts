import type { Level, Role } from './types.ts';
export const levels = ['profile', 'whatsapp', 'enrollment', 'full'] as const;
export const presets = ['exam-prep', 'language', 'skills', 'institution'] as const;
export const layouts = ['academic-editorial', 'course-discovery', 'contemporary-learning', 'institutional'] as const;
export const palettes = ['cobalt', 'forest', 'neutral', 'burgundy'] as const;
export const typography = ['editorial', 'modern', 'humanist'] as const;
const matrix: Record<Level, readonly string[]> = { profile: ['content'], whatsapp: ['content', 'inquiry'], enrollment: ['content', 'inquiry', 'enrollment', 'applications', 'records'], full: ['content', 'inquiry', 'enrollment', 'applications', 'records', 'finance', 'portal', 'attendance', 'materials', 'progress', 'reports'] };
export const capabilities = (level: Level) => [...matrix[level]];
export const has = (level: Level, feature: string) => matrix[level]?.includes(feature) ?? false;
export const isStaff = (role: Role | undefined) => role === 'admin' || role === 'staff';
export const canEdit = (role: Role | undefined) => isStaff(role) || role === 'editor';
export const reservedStatuses = new Set(['submitted', 'under_review', 'accepted', 'awaiting_payment', 'active']);
export class DomainError extends Error {
    status: number;
    code: string;
    constructor(code: string, status = 400) { super(code); this.code = code; this.status = status; }
}
export function check(condition: unknown, code: string, status = 400): asserts condition { if (!condition)
    throw new DomainError(code, status); }
export function need(level: Level, feature: string) { check(has(level, feature), 'feature_disabled', 403); }
export function text(value: unknown, max = 200): string { check(typeof value === 'string' && value.trim().length > 0 && value.length <= max, 'invalid_text'); return value.trim(); }
export function integer(value: unknown, min = 0, max = 1000000000): number { check(typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max, 'invalid_number'); return value; }
export function date(value: unknown): string { const s = text(value, 50); check(Number.isFinite(Date.parse(s)), 'invalid_date'); return new Date(s).toISOString(); }
