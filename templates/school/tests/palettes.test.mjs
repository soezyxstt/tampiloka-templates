import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const css = await readFile(new URL('../src/styles/school.css', import.meta.url), 'utf8');
const rules = [...css.matchAll(/:root(?:\[data-palette=[\w-]+\])?\s*\{([^}]+)\}/g)].slice(0, 4);
function luminosity(color) { const rgb = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; }
function ratio(a, b) { const x = [luminosity(a), luminosity(b)].sort((a, b) => b - a); return (x[0] + .05) / (x[1] + .05); }
const parse = s => Object.fromEntries([...s.matchAll(/(--[\w-]+):\s*(#[a-fA-F0-9]{6})/g)].map(m => [m[1], m[2]]));
const base = parse(rules[0][1]);
for (const r of rules)
    test(`accessible school palette ${r[0].split('{')[0]}`, () => { const p = { ...base, ...parse(r[1]) }; for (const surface of ['--brand-canvas', '--brand-surface']) {
        assert.ok(ratio(p['--brand-text'], p[surface]) >= 7);
        assert.ok(ratio(p['--brand-muted'], p[surface]) >= 4.5);
        assert.ok(ratio(p['--brand-focus'], p[surface]) >= 3);
        assert.ok(ratio(p['--school-strong'], p[surface]) >= 3);
    } assert.ok(ratio(p['--brand-action'], p['--brand-on-action']) >= 4.5); });
