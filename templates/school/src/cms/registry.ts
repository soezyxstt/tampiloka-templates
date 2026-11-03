import type { Context, Field, Json, PageBlock, SchoolState, Text } from '../domain/types.ts';
import { check, text } from '../domain/capabilities.ts';
export interface Collection {
    id: string;
    label: Text;
    fields: Field[];
}
export interface BlockDefinition {
    id: string;
    label: Text;
    validate: (block: PageBlock) => void;
}
export interface BusinessModule {
    id: string;
    label: Text;
    minimum: 'profile' | 'enrollment' | 'full';
    command?: (state: SchoolState, ctx: Context, payload: Record<string, unknown>) => Json;
}
export interface Extension {
    collections?: Collection[];
    blocks?: BlockDefinition[];
    programTypes?: string[];
    registrationFields?: Field[];
    adminViews?: {
        id: string;
        label: Text;
        roles: string[];
    }[];
    modules?: BusinessModule[];
    beforeEnrollment?: ((state: SchoolState, ctx: Context, answers: Record<string, Json>) => void)[];
}
const bi = (id: string, en: string): Text => ({ id, en });
const body = (b: PageBlock) => { for (const l of ['id', 'en'] as const) {
    text(b.heading[l], 200);
    check(typeof b.body[l] === 'string' && b.body[l].length <= 8000, 'invalid_block');
} check(!b.image || /^https:\/\/|^\/images\/|^\/api\/media\//.test(b.image), 'invalid_media'); };
export const cms = {
    collections: new Map<string, Collection>([
        ['pages', { id: 'pages', label: bi('Halaman', 'Pages'), fields: [] }],
        ['programs', { id: 'programs', label: bi('Program', 'Programs'), fields: [] }],
        ['announcements', { id: 'announcements', label: bi('Kabar dan informasi', 'News and information'), fields: [
            { name: 'kind', label: bi('Kategori', 'Category'), type: 'select', options: ['news', 'achievement', 'activity', 'administration'] },
            { name: 'date', label: bi('Tanggal terbit (YYYY-MM-DD)', 'Publication date (YYYY-MM-DD)'), type: 'text' },
        ] }],
        ['gallery', { id: 'gallery', label: bi('Galeri', 'Gallery'), fields: [] }],
    ]),
    blocks: new Map<string, BlockDefinition>(['text', 'image-text', 'faq', 'outcomes', 'testimonial', 'facilities'].map(id => [id, { id, label: bi(id, id), validate: body }])),
    programTypes: new Set(['exam-prep', 'language', 'skills', 'institution']),
    registrationFields: [] as Field[], adminViews: [] as NonNullable<Extension['adminViews']>,
    modules: new Map<string, BusinessModule>([
        ['progress-reports', { id: 'progress-reports', label: bi('Laporan belajar', 'Progress reports'), minimum: 'full' }],
        ['additional-branches', { id: 'additional-branches', label: bi('Cabang tambahan', 'Additional branches'), minimum: 'profile' }],
        ['notifications', { id: 'notifications', label: bi('Notifikasi', 'Notifications'), minimum: 'enrollment' }],
    ]), beforeEnrollment: [] as NonNullable<Extension['beforeEnrollment']>,
};
export function registerExtension(extension: Extension) {
    validateFieldDefinitions([...cms.registrationFields, ...extension.registrationFields ?? []]);
    for (const c of extension.collections ?? []) {
        check(!cms.collections.has(c.id), 'duplicate_collection');
        cms.collections.set(c.id, c);
    }
    for (const b of extension.blocks ?? []) {
        check(!cms.blocks.has(b.id), 'duplicate_block');
        cms.blocks.set(b.id, b);
    }
    for (const m of extension.modules ?? []) {
        check(!cms.modules.has(m.id), 'duplicate_module');
        cms.modules.set(m.id, m);
    }
    for (const p of extension.programTypes ?? [])
        cms.programTypes.add(p);
    cms.registrationFields.push(...extension.registrationFields ?? []);
    cms.adminViews.push(...extension.adminViews ?? []);
    cms.beforeEnrollment.push(...extension.beforeEnrollment ?? []);
}
export function visible(field: Field, values: Record<string, unknown>) { return !field.when || values[field.when.field] === field.when.equals; }
export function validateFields(fields: Field[], values: Record<string, unknown>): Record<string, Json> {
    const out: Record<string, Json> = {};
    for (const f of fields) {
        check(/^[a-z][a-zA-Z0-9_]{0,40}$/.test(f.name) && !['constructor', 'prototype', '__proto__'].includes(f.name), 'invalid_field');
        if (!visible(f, values))
            continue;
        const v = values[f.name];
        const empty = v === undefined || v === null || v === '';
        check(!f.required || (!empty && (f.type !== 'checkbox' || v === true)), `required:${f.name}`);
        if (empty)
            continue;
        if (f.type === 'checkbox')
            check(typeof v === 'boolean', `invalid:${f.name}`);
        else if (f.type === 'number')
            check(typeof v === 'number' && Number.isFinite(v) && v >= (f.min ?? 0) && v <= (f.max ?? 1e9), `invalid:${f.name}`);
        else {
            check(typeof v === 'string' && v.length <= (f.maxLength ?? 500), `invalid:${f.name}`);
            if (f.type === 'email')
                check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), `invalid:${f.name}`);
            if (f.type === 'select')
                check(f.options?.includes(v), `invalid:${f.name}`);
        }
        out[f.name] = v as Json;
    }
    return out;
}
export function validateFieldDefinitions(fields: Field[]) {
    check(Array.isArray(fields) && fields.length <= 30, 'invalid_fields');
    const names = new Set<string>();
    for (const f of fields) {
        check(f && typeof f.name === 'string' && /^[a-z][a-zA-Z0-9_]{0,40}$/.test(f.name) && !['constructor', 'prototype', '__proto__'].includes(f.name) && !names.has(f.name), 'invalid_field');
        names.add(f.name);
        check(['text', 'textarea', 'email', 'number', 'select', 'checkbox'].includes(f.type), 'invalid_field');
        text(f.label.id, 150);
        text(f.label.en, 150);
        if (f.type === 'select')
            check(Array.isArray(f.options) && f.options.length > 0 && f.options.length <= 50 && f.options.every(v => typeof v === 'string' && v.length <= 100), 'invalid_options');
        check(f.required === undefined || typeof f.required === 'boolean', 'invalid_field');
        check(f.maxLength === undefined || Number.isInteger(f.maxLength) && f.maxLength >= 1 && f.maxLength <= 12000, 'invalid_field');
        for (const v of [f.min, f.max])
            check(v === undefined || typeof v === 'number' && Number.isFinite(v), 'invalid_field');
        check(f.min === undefined || f.max === undefined || f.min <= f.max, 'invalid_field');
        if (f.when)
            check(f.when.field !== f.name && fields.some(x => x.name === f.when?.field) && ['string', 'boolean'].includes(typeof f.when.equals), 'invalid_condition');
    }
}
