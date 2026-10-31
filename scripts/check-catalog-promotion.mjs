import { validatePublicCatalog } from '../packages/registry/src/public-catalog.mjs';

// Only workflows with a hosted deployment and customer-flow check may certify a family.
const releaseWorkflows = Object.fromEntries(['cafe', 'commerce', 'school', 'booking'].map(family => [family, { workflow: 'release-demos.yml', job: `release (${family})` }]));

export async function checkCatalogPromotion(previous, next, verifyRelease) {
  previous = validatePublicCatalog(previous);
  next = validatePublicCatalog(next);
  for (const family of next.families) {
    const oldFamily = previous.families.find(item => item.id === family.id);
    const entries = next.entries.filter(item => item.family === family.id);
    const changed = !oldFamily || oldFamily.release !== family.release || entries.some(entry => {
      const old = previous.entries.find(item => item.id === entry.id && item.family === entry.family);
      return !old || old.url !== entry.url || old.imageUrl !== entry.imageUrl || JSON.stringify(old.modeUrls) !== JSON.stringify(entry.modeUrls);
    });
    if (!changed) continue;
    if (!family.release || !releaseWorkflows[family.id]) throw new Error(`No supported hosted release evidence for ${family.id}`);
    if (!await verifyRelease(family.id, family.release, releaseWorkflows[family.id])) throw new Error(`Hosted release verification failed for ${family.id} at ${family.release}`);
  }
}

// Retain only the affected family's previous public entries when its promotion
// cannot be verified. Explicit removals from the proposed feed remain effective.
export async function reconcileCatalogPromotion(previous, next, verifyRelease) {
  previous = validatePublicCatalog(previous);
  next = validatePublicCatalog(next);
  const blocked = [];
  const families = [];
  const entries = [];
  for (const family of next.families) {
    const proposed = next.entries.filter(entry => entry.family === family.id);
    const oldFamily = previous.families.find(item => item.id === family.id);
    try {
      await checkCatalogPromotion(previous, { ...next, families: [family], entries: proposed }, verifyRelease);
      families.push(family);
      entries.push(...proposed);
    } catch (error) {
      blocked.push({ family: family.id, reason: String(error.message ?? error) });
      if (oldFamily) {
        families.push({ ...oldFamily, name: family.name, description: family.description,
          ...(oldFamily.modes ? { modes: oldFamily.modes.map(mode => {
            const copy = family.modes?.find(item => item.id === mode.id);
            return copy ? { ...mode, name: copy.name, description: copy.description } : mode;
          }) } : {}),
        });
        const proposedIds = new Set(proposed.map(entry => entry.id));
        entries.push(...previous.entries.filter(entry => entry.family === family.id && proposedIds.has(entry.id)).map(entry => {
          const copy = proposed.find(item => item.id === entry.id);
          return { ...entry, name: copy.name, description: copy.description, featured: copy.featured };
        }));
      }
    }
  }
  return { catalog: validatePublicCatalog({ ...next, families, entries }), blocked };
}
