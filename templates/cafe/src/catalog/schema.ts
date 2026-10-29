import { z } from 'zod';

const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Use letters, numbers, underscores or hyphens.');
const name = z.string().trim().min(1).max(160);
const rupiah = z.number().int().min(0).max(1_000_000_000);
const photo = z.string().max(2048).refine((value) => {
  if (/^\/(images|brand)\//.test(value)) {
    return !/[\\?#\u0000-\u001f]/.test(value) && !value.split('/').some((part) => part === '..' || part === '.');
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash;
  } catch { return false; }
}, 'Use a /images/ or /brand/ path, or a public HTTPS image URL.');

const category = z.object({ id, name, sortOrder: z.number().int().min(0), active: z.boolean() }).strict();
const variant = z.object({ id, name, priceIdr: rupiah, isDefault: z.boolean(), available: z.boolean() }).strict();
const option = z.object({ id, name, priceIdr: rupiah }).strict();
const group = z.object({
  id, name, required: z.boolean(), minSelect: z.number().int().min(0).max(30),
  maxSelect: z.number().int().min(1).max(30), options: z.array(option).min(1).max(30),
}).strict().superRefine((value, context) => {
  if (value.minSelect > value.maxSelect || value.maxSelect > value.options.length) {
    context.addIssue({ code: 'custom', path: ['maxSelect'], message: 'Selection limits must fit the available options.' });
  }
  if ((value.required && value.minSelect < 1) || (!value.required && value.minSelect !== 0)) {
    context.addIssue({ code: 'custom', path: ['minSelect'], message: 'Required groups need a minimum of 1; optional groups use 0.' });
  }
});

const item = z.object({
  id, categoryId: id, name, description: z.string().max(1500),
  photos: z.array(photo).max(12), allergens: z.array(z.string().min(1).max(80)).max(30),
  tags: z.array(z.string().min(1).max(60)).max(30), active: z.boolean(), available: z.boolean(),
  sortOrder: z.number().int().min(0), variants: z.array(variant).min(1).max(30),
  modifierGroups: z.array(group).max(20),
}).strict().superRefine((value, context) => {
  if (value.variants.filter((entry) => entry.isDefault).length !== 1) {
    context.addIssue({ code: 'custom', path: ['variants'], message: 'Choose exactly one default variant.' });
  }
});

export const menuSchema = z.object({
  schemaVersion: z.literal(1),
  sample: z.boolean(),
  info: z.object({
    openHoursText: z.string().max(240), facilitiesText: z.string().max(600),
    availabilityNote: z.string().max(240), serviceChargeBps: z.number().int().min(0).max(3000),
    taxBps: z.number().int().min(0).max(3000), taxInclusiveDisplay: z.boolean(), serviceInTaxBase: z.boolean(),
  }).strict(),
  categories: z.array(category).max(100), items: z.array(item).max(2000),
}).strict().superRefine((value, context) => {
  const seen = new Map<string, Set<string>>();
  const unique = (kind: string, value: string, path: (string | number)[]) => {
    const ids = seen.get(kind) || new Set<string>();
    if (ids.has(value)) context.addIssue({ code: 'custom', path, message: `Duplicate ${kind} ID: ${value}` });
    ids.add(value); seen.set(kind, ids);
  };
  value.categories.forEach((entry, index) => unique('category', entry.id, ['categories', index, 'id']));
  const categoryMap = new Map(value.categories.map((entry) => [entry.id, entry]));
  value.items.forEach((entry, index) => {
    unique('item', entry.id, ['items', index, 'id']);
    const category = categoryMap.get(entry.categoryId);
    if (!category || (entry.active && !category.active)) context.addIssue({ code: 'custom', path: ['items', index, 'categoryId'], message: 'An active item needs an active category that exists.' });
    entry.variants.forEach((variant, variantIndex) => unique('variant', variant.id, ['items', index, 'variants', variantIndex, 'id']));
    entry.modifierGroups.forEach((group, groupIndex) => {
      unique('modifier group', group.id, ['items', index, 'modifierGroups', groupIndex, 'id']);
      group.options.forEach((option, optionIndex) => unique('modifier option', option.id, ['items', index, 'modifierGroups', groupIndex, 'options', optionIndex, 'id']));
    });
  });
});

export const tablesSchema = z.object({
  schemaVersion: z.literal(1),
  tables: z.array(z.object({ id, label: z.string().min(1).max(40), areaName: z.string().max(100), qrToken: id, capacity: z.number().int().min(1).max(100), active: z.boolean() }).strict()).max(500),
}).strict().superRefine((value, context) => {
  for (const field of ['id', 'qrToken', 'label'] as const) {
    const seen = new Set<string>();
    value.tables.forEach((table, index) => {
      if (seen.has(table[field])) context.addIssue({ code: 'custom', path: ['tables', index, field], message: `Duplicate table ${field}.` });
      seen.add(table[field]);
    });
  }
});

export type StaticMenu = z.infer<typeof menuSchema>;
export type StaticTables = z.infer<typeof tablesSchema>;

export function validateCatalogContent(menu: unknown, tables: unknown): { menu: StaticMenu; tables: StaticTables } {
  const parsedMenu = menuSchema.safeParse(menu);
  const parsedTables = tablesSchema.safeParse(tables);
  if (!parsedMenu.success || !parsedTables.success) {
    const issues = [
      ...(!parsedMenu.success ? parsedMenu.error.issues.map((issue) => `content/menu.json.${issue.path.join('.')}: ${issue.message}`) : []),
      ...(!parsedTables.success ? parsedTables.error.issues.map((issue) => `content/tables.json.${issue.path.join('.')}: ${issue.message}`) : []),
    ];
    throw new Error(`Static catalog is invalid:\n${issues.join('\n')}`);
  }
  return { menu: parsedMenu.data, tables: parsedTables.data };
}
