import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/config/catalog.mjs';
import { browserDemoIdentity } from '../src/demo-runtime/scope-identity.ts';
import { resolveDemoConfiguration } from '../demos/configuration.ts';
import { DEMOS, demoNavigationPath } from '../demos/manifest.ts';

const configAt = href => resolveDemoConfiguration(DEFAULT_CONFIG, new URL(href)).config;

test('customer, cashier and table launchers for each preset use the same identity across themes and languages', () => {
  for (const demo of DEMOS) {
    for (const hostname of ['preview.example.test', 'cafe-full.tampiloka.site', `${demo.subdomain}.tampiloka.site`]) {
      const base = `https://${hostname}`;
      const customer = configAt(`${base}${demoNavigationPath(demo, 'pelanggan', hostname)}?theme=airy&lang=en`);
      const staff = configAt(`${base}${demoNavigationPath(demo, 'staf', hostname)}?theme=boxy&lang=id&staff=staff_cashier`);
      const table = configAt(`${base}/t/dapur-pagi/${demo.subdomain}/m/table-1?theme=playful`);
      assert.equal(customer.venue.outletSlug, demo.subdomain);
      assert.equal(browserDemoIdentity(customer), browserDemoIdentity(staff), `${demo.id}: role changes its database`);
      assert.equal(browserDemoIdentity(customer), browserDemoIdentity(table), `${demo.id}: table route changes its database`);
    }
  }
});

test('presets and incompatible runtime configurations remain isolated on one origin', () => {
  const configs = DEMOS.map(demo => configAt(`https://preview.example.test/p/${demo.id}/`));
  assert.equal(new Set(configs.map(browserDemoIdentity)).size, DEMOS.length);
  // The compatibility alias shares modules with catalog but is still a distinct preset.
  assert.notEqual(browserDemoIdentity(configs[0]), browserDemoIdentity(configs[1]));
  const full = configs.find(config => config.venue.outletSlug === 'cafe-full');
  assert.notEqual(browserDemoIdentity(full), browserDemoIdentity({ ...full, modules: full.modules.slice(0, -1) }));
  assert.notEqual(browserDemoIdentity(full), browserDemoIdentity({ ...full, payment: { mode: 'cashier' } }));
  assert.notEqual(browserDemoIdentity(full), browserDemoIdentity({ ...full, venue: { ...full.venue, tenantSlug: 'other' } }));
  assert.equal(browserDemoIdentity(full), JSON.stringify({ tenant: 'dapur-pagi', outlet: 'cafe-full', modules: full.modules, payment: 'both' }), 'keep the existing storage identity');
});
