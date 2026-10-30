#!/usr/bin/env node
/**
 * Frontend design-token guard. Rules live in AGENTS.md ("Frontend rules").
 *  1. Raw colors (#hex, rgb(), hsl()) may appear only in CSS custom-property
 *     declarations (`--token: #hex`), var() fallbacks, or token source files.
 *  2. No text smaller than 12px (`font-size: Npx` or Tailwind `text-[Npx]`).
 * Usage: node scripts/check-design-tokens.mjs [--json]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const UI = /^(templates\/[^/]+\/(app|components|src|demos)\/|packages\/ui-core\/src\/).*\.(css|tsx|ts)$/;
const SKIP = /(\.test\.|\/tests?\/|\/scripts\/|\/worker\/|\/db\/|\/domain\/|demo-runtime\/|\.d\.ts$|\.generated\.)/;
/** Files that *define* palettes. Keep this list short. */
const TOKEN_SOURCES = new Set([
  'templates/cafe/src/config/catalog.mjs',
  'templates/cafe/src/config/cafe.ts',
]);
const MIN_FONT_PX = 12;

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\n').filter(f => UI.test(f) && !SKIP.test(f) && !TOKEN_SOURCES.has(f));

const color = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g;
const findings = [];
for (const file of files) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  // Split minified CSS into declarations so line numbers stay meaningful.
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const declarations = file.endsWith('.css') ? line.split(/[;{}]/) : [line];
    for (const raw of declarations) {
      const decl = raw
        .replace(/var\(\s*--[\w-]+\s*,[^()]*(?:\([^()]*\)[^()]*)*\)/g, 'var()') // fallbacks are allowed
        .replace(/\/\*.*?\*\//g, '');
      const isTokenDeclaration = /^\s*--[\w-]+\s*:/.test(decl) || /['"]--[\w-]+['"]\s*:/.test(decl);
      if (!isTokenDeclaration) {
        for (const match of decl.matchAll(color)) {
          if (/^#(?:fff|ffffff|000|000000)$/i.test(match[0])) continue; // pure white/black ink on fills
          if (/^#[0-9a-f]{3,8}$/i.test(match[0]) && /&#|#[0-9a-f]+;/i.test(decl)) continue; // HTML entities
          findings.push({ file, line: index + 1, rule: 'raw-color', value: match[0] });
        }
      }
      for (const match of decl.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px|text-\[(\d+(?:\.\d+)?)px\]/g)) {
        const px = Number(match[1] ?? match[2]);
        if (px < MIN_FONT_PX) findings.push({ file, line: index + 1, rule: 'min-font-size', value: `${px}px` });
      }
    }
  });
}

if (process.argv.includes('--json')) console.log(JSON.stringify(findings, null, 2));
else if (process.argv.includes('--summary')) {
  const byFile = {};
  for (const f of findings) (byFile[f.file] ??= {})[f.rule] = (byFile[f.file]?.[f.rule] || 0) + 1;
  for (const [file, rules] of Object.entries(byFile)) console.log(`${file}  ${JSON.stringify(rules)}`);
  console.log(`${findings.length} finding(s)`);
}
else {
  for (const f of findings) console.log(`${f.file}:${f.line}  ${f.rule}  ${f.value}`);
  const byRule = findings.reduce((acc, f) => ({ ...acc, [f.rule]: (acc[f.rule] || 0) + 1 }), {});
  console.log(findings.length ? `\n${findings.length} finding(s): ${JSON.stringify(byRule)}` : `Design tokens OK (${files.length} files checked).`);
}
process.exitCode = findings.length ? 1 : 0;
