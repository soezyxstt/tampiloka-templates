import translations from './sample-menu-en.json' with { type: 'json' };

const samples: Record<string, Record<string, string[]>> = translations;

export function localizeSampleName(id: string, value: string, language: 'id' | 'en', demo: boolean): string {
  const names = samples[id]?.name;
  if (!demo || !names || !names.includes(value)) return value;
  return names[language === 'en' ? 1 : 0];
}

function translateEntry(entry: any) {
  const fields = samples[entry.id];
  if (!fields) return entry;
  const translated = { ...entry };
  for (const [field, [original, english]] of Object.entries(fields)) {
    if (entry[field] === original) translated[field] = english;
  }
  return translated;
}

// Only translate unchanged, identified sample content; customer edits remain intact.
export function localizeSampleMenu(snapshot: any, language: 'id' | 'en') {
  if (language !== 'en' || !snapshot?.runtime?.demo) return snapshot;
  return {
    ...snapshot,
    categories: snapshot.categories.map(translateEntry),
    catalog: snapshot.catalog.map((item: any) => ({
      ...translateEntry(item),
      variants: item.variants.map(translateEntry),
      modifierGroups: item.modifierGroups.map((group: any) => ({
        ...translateEntry(group), options: group.options.map(translateEntry),
      })),
    })),
  };
}
