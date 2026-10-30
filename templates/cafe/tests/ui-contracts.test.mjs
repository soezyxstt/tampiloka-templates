import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PRESETS, validateConfig, applyPreset, DEFAULT_CONFIG } from '../src/config/catalog.mjs';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('catalog preset includes guest requests and staff inbox but no POS, kitchen or online payment',()=>{
 const config=validateConfig(applyPreset(DEFAULT_CONFIG,'catalog'));
 assert.deepEqual(config.modules,['catalog','ordering']);assert.equal(config.payment.mode,'cashier');
 assert.deepEqual(config.modules,PRESETS['order-at-cashier'].modules);
});
test('a read-only catalog remains available through explicit modules',()=>{
 const config=validateConfig({...DEFAULT_CONFIG,modules:['catalog'],payment:{mode:'cashier'}});
 assert.deepEqual(config.modules,['catalog']);
});
test('customer categories and staff navigation share ChoiceStrip',async()=>{
 assert.match(await read('components/cafe/customer-app.tsx'),/<ChoiceStrip/);
 assert.match(await read('components/ui/animated-tabs.tsx'),/<ChoiceStrip/);
 assert.doesNotMatch(await read('components/cafe/customer-app.tsx'),/styles\.categor(?:y|ies)/);
});
test('messages use the wrapping notice primitive, not non-shrinking badges',async()=>{
 const staff=await read('components/cafe/staff-app.tsx');
 assert.match(staff,/<InlineNotice tone="success">\{actionNotice\}/);
 assert.doesNotMatch(staff,/<StatusLabel label=\{actionNotice\}/);
 const css=await read('components/ui/workspace.css');
 assert.match(css,/\.ui-notice-text\{[^}]*min-width:0[^}]*overflow-wrap:anywhere/);
 assert.doesNotMatch(css,/(?:html|body)\s*\{[^}]*overflow-x\s*:\s*(?:hidden|clip)/);
});
test('native select markup has one source across application and showcase',async()=>{
 async function walk(dir){let files=[];for(const entry of await readdir(new URL('../'+dir,import.meta.url),{withFileTypes:true}).catch(error=>{if(error.code==='ENOENT')return [];throw error;})){const path=join(dir,entry.name);if(entry.isDirectory())files.push(...await walk(path));else if(path.endsWith('.tsx'))files.push(path);}return files;}
 for(const file of [...await walk('components'),...await walk('demos')]) if(file!==join('components','ui','select.tsx')) assert.doesNotMatch(await read(file),/<select(?:\s|>)/,file);
});
