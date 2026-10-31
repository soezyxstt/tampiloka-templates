const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(message) { throw new Error(`Public catalog: ${message}`); }
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`invalid ${label}`);
  return value;
}
function slug(value, label) {
  if (typeof value !== 'string' || value.length > 100 || !SLUG.test(value)) fail(`invalid ${label}`);
  return value;
}
function localized(value, label) {
  object(value, label);
  for (const locale of ['id', 'en']) {
    if (typeof value[locale] !== 'string' || !value[locale].trim() || value[locale].length > 1200) fail(`missing ${label}.${locale}`);
  }
  return { id: value.id, en: value.en };
}
function https(value, label) {
  if (typeof value !== 'string' || value.length > 2048) fail(`invalid ${label}`);
  let url;
  try { url = new URL(value); } catch { fail(`invalid ${label}`); }
  if (url.protocol !== 'https:' || url.username || url.password) fail(`${label} must be an absolute HTTPS URL without credentials`);
  return url.href;
}

/** Strict publication boundary. Only the documented, public fields leave this module. */
export function validatePublicCatalog(value) {
  object(value, 'document');
  if (value.schemaVersion !== 1) fail('unsupported schemaVersion');
  if (typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))) fail('invalid updatedAt');
  if (!Array.isArray(value.families) || value.families.length > 100 || !Array.isArray(value.entries) || value.entries.length > 5000) fail('invalid collections');
  const ids = new Set();
  const families = value.families.map(item => {
    object(item, 'family');
    const id = slug(item.id, 'family id');
    if (ids.has(id)) fail(`duplicate family ${id}`);
    ids.add(id);
    const result = { id, name: localized(item.name, `family ${id} name`) };
    if (item.description !== undefined) result.description = localized(item.description, `family ${id} description`);
    if (item.release !== undefined) {
      if (typeof item.release !== 'string' || !/^[a-f0-9]{40}$/.test(item.release)) fail(`invalid release in ${id}`);
      result.release = item.release;
    }
    if (item.modes !== undefined) {
      if (!Array.isArray(item.modes) || item.modes.length > 100) fail(`invalid modes in ${id}`);
      const modes = new Set();
      result.modes = item.modes.map(mode => {
        object(mode, 'mode');
        const modeId = slug(mode.id, 'mode id');
        if (modes.has(modeId)) fail(`duplicate mode ${modeId}`);
        modes.add(modeId);
        return { id: modeId, name: localized(mode.name, 'mode name'), ...(mode.description === undefined ? {} : { description: localized(mode.description, 'mode description') }) };
      });
    }
    if (item.defaultMode !== undefined) {
      result.defaultMode = slug(item.defaultMode, 'default mode');
      if (!result.modes?.some(mode => mode.id === result.defaultMode)) fail(`unknown default mode in ${id}`);
    }
    return result;
  });
  const entries = value.entries.map(item => {
    object(item, 'entry');
    if (item.visibility !== 'public') fail('non-public entry reached publication');
    const id = slug(item.id, 'entry id');
    const family = families.find(family => family.id === item.family);
    if (!family) fail(`unknown family for ${id}`);
    if (ids.has(`entry:${id}`)) fail(`duplicate entry ${id}`);
    ids.add(`entry:${id}`);
    const result = {
      id, family: family.id, name: localized(item.name, `entry ${id} name`),
      description: localized(item.description, `entry ${id} description`),
      url: https(item.url, `entry ${id} URL`), imageUrl: https(item.imageUrl, `entry ${id} image`), visibility: 'public',
    };
    if (item.featured !== undefined) {
      if (typeof item.featured !== 'boolean') fail('invalid featured flag');
      result.featured = item.featured;
    }
    if (item.modeUrls !== undefined) {
      result.modeUrls = {};
      for (const [mode, url] of Object.entries(object(item.modeUrls, 'modeUrls'))) {
        if (!family.modes?.some(item => item.id === mode)) fail(`unknown mode ${mode} for ${id}`);
        result.modeUrls[mode] = https(url, `mode ${mode} URL`);
      }
    }
    for (const mode of family.modes ?? []) {
      if (!result.modeUrls?.[mode.id]) fail(`missing mode URL ${mode.id} for ${id}`);
    }
    return result;
  });
  return { schemaVersion: 1, updatedAt: value.updatedAt, families: families.filter(family => entries.some(entry => entry.family === family.id)), entries };
}

/** Routing rules are data, so adding a new family never needs a consumer change. */
export function buildPublicCatalog(registry, source, { updatedAt = new Date().toISOString() } = {}) {
  if (registry.schemaVersion !== 1 || source.schemaVersion !== 1 || !Array.isArray(registry.templates) || !Array.isArray(source.families)) fail('invalid source schema');
  const families = [];
  const entries = [];
  for (const metadata of source.families) {
    // Omitted visibility/readiness is deliberately not public.
    if (metadata.visibility !== 'public' || metadata.ready !== true) continue;
    const template = registry.templates.find(item => item.id === metadata.template);
    if (!template) fail(`unknown template ${metadata.template}`);
    if (template.status !== 'available') continue;
    if (!Array.isArray(metadata.entries)) fail(`missing entries for ${metadata.id}`);
    const family = { id: metadata.id, name: metadata.name, ...(metadata.description === undefined ? {} : { description: metadata.description }) };
    if (metadata.release !== undefined) family.release = metadata.release;
    if (metadata.modes !== undefined) family.modes = metadata.modes;
    if (metadata.defaultMode !== undefined) family.defaultMode = metadata.defaultMode;
    const route = object(metadata.route, 'route');
    if (!['template', 'preset'].includes(route.base)) fail(`unknown route base in ${metadata.id}`);
    for (const key of ['presetParam', 'modeParam']) {
      if (route[key] !== undefined && (typeof route[key] !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(route[key]))) fail(`invalid route ${key}`);
    }
    for (const mode of family.modes ?? []) {
      if (!template.levels?.[mode.id]) fail(`unknown registered mode ${mode.id}`);
      if (!route.modeParam) fail(`missing mode query parameter in ${metadata.id}`);
    }
    for (const item of metadata.entries) {
      if (item.visibility !== 'public' || item.ready !== true) continue;
      const preset = template.presets?.[item.preset];
      if (!preset) fail(`unknown preset ${metadata.template}/${item.preset}`);
      const url = new URL(https(route.base === 'preset' ? preset.url : template.demoUrl, 'registered demo URL'));
      if (route.presetParam) url.searchParams.set(route.presetParam, item.preset);
      if (family.defaultMode) url.searchParams.set(route.modeParam, family.defaultMode);
      const entry = {
        id: item.id, family: family.id, name: item.name, description: item.description,
        url: url.href, imageUrl: item.imageUrl, visibility: 'public', ...(item.featured === undefined ? {} : { featured: item.featured }),
      };
      if (family.modes?.length) {
        entry.modeUrls = Object.fromEntries(family.modes.map(mode => {
          const modeUrl = new URL(url);
          modeUrl.searchParams.set(route.modeParam, mode.id);
          return [mode.id, modeUrl.href];
        }));
      }
      entries.push(entry);
    }
    families.push(family);
  }
  return validatePublicCatalog({ schemaVersion: 1, updatedAt, families, entries });
}
