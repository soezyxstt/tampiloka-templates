import {readFile,writeFile,rm} from 'node:fs/promises';
import assert from 'node:assert/strict';
const read=p=>readFile(p,'utf8'),put=(p,t)=>writeFile(p,t);
const once=(t,a,b)=>{assert.ok(t.includes(a),'Missing anchor: '+a.slice(0,100));return t.replace(a,b);};
let t=await read('tests/demos-staff-layout.mjs');
t=once(t,"const overflow = await page.addStyleTag({ content: '#staff-content { min-width: 500px !important; }' });\n        try {", "const overflow = await page.addStyleTag({ content: '#staff-content { min-width: 500px !important; }' });\n        try {\n          // Assert that the injected defect has actually reached browser layout.\n          await page.waitForFunction(() => { const main=document.getElementById('staff-content'); return main && getComputedStyle(main).minWidth==='500px' && main.getBoundingClientRect().width>=500; }, null, { timeout:5000 });\n          await settle(page);");
await put('tests/demos-staff-layout.mjs',t);
t=await read('tests/demos-lifecycle-fixtures.mjs');t=once(t,"  { id: 'external-counter',", "  { id: 'catalog-waiter', title: 'Katalog: daftar tamu, inbox pelayan, penyajian dan struk pembayaran offline' },\n  { id: 'external-counter',");await put('tests/demos-lifecycle-fixtures.mjs',t);
t=await read('scripts/demos-verify.mjs');
t=once(t,'  for (const script of', '  const failures = [];\n  for (const script of');
t=once(t,'if (code !== 0) throw new Error(`${script} failed (${signal || code}).`);','if (code !== 0) failures.push(`${script} failed (${signal || code}).`);');
t=once(t,'  }\n} finally {','  }\n  if (failures.length) throw new Error(failures.join("\\n"));\n} finally {');
await put('scripts/demos-verify.mjs',t);
t=await read('components/ui/workspace.css');t+='\n@media(max-width:639px){.choice-strip[data-variant=segmented] .choice-item{min-height:44px}}\n';await put('components/ui/workspace.css',t);

const edits={
 'README.md':[
 ['Generated `catalog` projects use the database-free path instead.','Only projects generated with exactly `--modules catalog` use the database-free path. The `catalog` preset includes the waiter inbox and uses the transactional runtime.'],
 ['| `catalog` | Public menu and table QR entry |','| `catalog` | Public menu, personal order list, waiter inbox and offline payment confirmation |'],
 ['| `order-at-cashier` | Menu, customer ordering, and a staff inbox; payment is handled outside online checkout |','| `order-at-cashier` | Compatibility alias for `catalog`, with the same modules and offline payment flow |'],
 ['| Menu catalog |','| Menu and waiter requests |'],
 ['Create an exact `catalog` project:','Create a read-only project with exactly the `catalog` module:'],
 ['### Nine service presets','### Service presets and compatibility aliases'],
 ],
 'docs/client-setup.md':[
 ['A `catalog` client starts in static mode with `CAFE_DEMO_DB=0`; use `npm run dev`. Other packages start with demo mode and `CAFE_DEMO_EMPTY=1` enabled; use `npm run demo`.','A client with exactly `--modules catalog` starts in static mode with `CAFE_DEMO_DB=0`; use `npm run dev`. The `catalog` preset and other transactional packages start with demo mode and `CAFE_DEMO_EMPTY=1` enabled; use `npm run demo`.'],
 ['If you switch an existing demo to `catalog` with `configure`, also disable `CAFE_DEMO_DB`','If you switch an existing demo to exactly `--modules catalog` with `configure`, also disable `CAFE_DEMO_DB`'],
 ['| `catalog` | Menu catalog | No order or checkout flow |','| `catalog` | Catalog, guest lists and waiter inbox | Offline; staff confirms an external-register receipt |'],
 ['| `order-at-cashier` | Catalog, customer ordering | Pay at the cashier |','| `order-at-cashier` | Compatibility alias for `catalog` | Same offline flow |'],
 ],
 'docs/demos.md':[
 ['It compares nine service packages,','It compares service presets, including the legacy `order-at-cashier` alias,'],
 ['Searchable menu, item details and QR entry; no customer ordering or staff workspace','Searchable menu, guest order list, waiter inbox, fulfillment and offline receipt confirmation'],
 ['The catalog package reads validated public menu JSON without initializing a database.','The catalog preset now initializes the same browser-local transaction runtime as ordering. Only a separately generated `--modules catalog` project stays database-free.'],
 ['The hub and catalog do not wait for that engine.','Only the hub and explicit read-only catalog projects avoid that engine.'],
 ['Run both browser suites','Run the interaction, layout, preset and lifecycle suites'],
 ['CI runs both browser gates','CI runs all browser gates'],
 ],
 'docs/runtime.md':[
 ['The `catalog` preset (`modules: ["catalog"]`)','An explicitly read-only project (`--modules catalog`, or `modules: ["catalog"]`)'],
 ['The ordering-only `order-at-cashier` package','The ordering-only `catalog` preset and its `order-at-cashier` compatibility alias'],
 ['The public catalog described above can run live.','The explicit read-only catalog described above can run live. The new `catalog` preset includes requests and therefore has the transactional launch requirements below.'],
 ['- A real payment provider account, signed webhook verification, amount/account matching and replay handling.','- A real payment provider account, signed webhook verification, amount/account matching and replay handling only when online payments are enabled. Offline waiter-request packages still need authenticated staff, private shared storage and durable receipts.'],
 ],
};
for(const [path,replacements] of Object.entries(edits)){t=await read(path);for(const [a,b]of replacements)t=once(t,a,b);await put(path,t);}
await put('docs/staff-layout-regression.md',`# Responsive staff and customer regression coverage

The original desktop sidebar used viewport-fixed positioning and covered the demo toolbar, disclaimer and scenario picker. The shared staff shell now uses an in-flow grid with a sticky sidebar and header. Expanding a demo panel needs no hard-coded offset. The current desktop sidebar is 216 px; tablet navigation stays above the workspace. Staff selection shows a name, with the role separately below the brand, and occupies a full-width mobile row or a 280 px tablet/desktop column.

## Interaction-state overflow

Payment feedback previously used a non-shrinking status badge. Long text widened the entire page. InlineNotice now wraps locally, including unbroken references; the root document never hides overflow. A new 320 px test also identified a narrow demo-toolbar overflow, and kitchen navigation exposed a flex wrapper whose minimum content width exceeded the phone viewport. Both constraints are fixed on their owning components.

## Browser gates

- demos-compact-ui.mjs triggers a real demo payment instruction, checks feedback at 320, 360, 390, 412, 768, 1280 and 1920 px, checks long unbroken text and tests all five customer themes. It exercises keyboard navigation, category filtering and account selection. A temporary no-wrap override must reproduce the feedback defect.
- demos-staff-layout.mjs checks all nine staff-enabled presets at 390, 768, 1024, 1279, 1280, 1440, 1920 and 2560 px, at the top and after scrolling. It tests hit targets, panels, account labels, sidebar geometry and dialog stacking. Negative controls must detect the old fixed sidebar and an injected 500 px content width on a 390 px viewport.
- demos-browser.mjs checks every preset and its allowed customer/staff controls.
- demos-lifecycle.mjs checks customer/staff journeys, including catalog-waiter with fulfillment and an offline receipt, and all 14 mock states.

Viewport changes wait for actual dimensions, media queries, sidebar visibility and account-control width to agree. Injected negative controls must first reach browser layout, then fail the unchanged geometry assertions. Tests never wait for overflow to disappear, loosen tolerances or retry failures until green. All suites run even when one fails, so a single run retains evidence for every suite and still exits unsuccessfully if any failed.

Run locally after installing Chromium:

\x60\x60\x60sh
npm run demos:build
npm run test:demo-all
\x60\x60\x60

Main-release verification compares the exact tested entry CSS and JavaScript on the hub and all nine hosts before running live layout, compact interaction and catalog handoff checks. CI also runs HTTP integration against freshly generated client projects. Evidence stays in CI artifacts, not the source tree. Public browser checks use fresh browser-local demo data and block network writes; they do not reset existing users' sessions.
`);
await rm('scripts/apply-compact-ui.mjs');await rm('.github/workflows/ui-apply.yml');
