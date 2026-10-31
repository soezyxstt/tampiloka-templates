import { validatePublicCatalog } from '../packages/registry/src/public-catalog.mjs';

// Only workflows with a hosted deployment and customer-flow check may certify a family.
const releaseWorkflows = { school: { workflow: 'school.yml', job: 'deploy-demo' } };

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

export async function verifyGithubRelease(family, release, { workflow, job }, request) {
  const runs = await request(`/actions/workflows/${workflow}/runs?branch=main&event=push&per_page=100`);
  // The newest deployment run must be complete and successful, not a prior green run.
  const run = runs.workflow_runs?.[0];
  if (!run || run.head_sha !== release || run.status !== 'completed' || run.conclusion !== 'success') return false;
  const jobs = await request(`/actions/runs/${run.id}/jobs?per_page=100`);
  return jobs.jobs?.some(item => item.name === job && item.status === 'completed' && item.conclusion === 'success') === true;
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
        families.push(oldFamily);
        const proposedIds = new Set(proposed.map(entry => entry.id));
        entries.push(...previous.entries.filter(entry => entry.family === family.id && proposedIds.has(entry.id)));
      }
    }
  }
  return { catalog: validatePublicCatalog({ ...next, families, entries }), blocked };
}
