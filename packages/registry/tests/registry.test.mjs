import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { templates, commercePresets, commerceLevels, cafePresets, capabilitiesFor, getTemplate } from '../src/index.mjs';
import { PRESETS as originalCafePresets } from '../../../templates/cafe/src/config/catalog.mjs';
import { resolveAppearance } from '../../theme-engine/src/index.mjs';

test('registry manifest and source stay identical',async()=>{
  const stored=JSON.parse(await readFile(new URL('../templates.json',import.meta.url),'utf8'));
  assert.deepEqual(stored.templates,templates);
});
test('all nine cafe packages remain available and match current cafe source',()=>{
  assert.deepEqual(Object.keys(cafePresets),Object.keys(originalCafePresets));assert.equal(Object.keys(cafePresets).length,9);
});
test('commerce levels enforce catalog and WhatsApp boundaries',()=>{
  assert.equal(capabilitiesFor('catalog').cart,false);assert.equal(capabilitiesFor('catalog').checkout,false);
  assert.equal(capabilitiesFor('whatsapp').whatsapp,true);assert.equal(capabilitiesFor('whatsapp').checkout,false);
  assert.equal(capabilitiesFor('store').checkout,true);assert.equal(capabilitiesFor('store').gateway,false);
  assert.equal(capabilitiesFor('advanced').gateway,true);assert.equal(capabilitiesFor('advanced').returns,true);
  assert.throws(()=>capabilitiesFor('enterprise'));
});
test('every commerce preset uses valid independent appearance values',()=>{
  for(const [id,preset]of Object.entries(commercePresets))assert.deepEqual(resolveAppearance(preset),{layout:id,palette:preset.palette,card:preset.card,button:preset.button});
  assert.equal(Object.keys(commerceLevels).length,4);
});
test('planned templates cannot be generated',()=>{
  for(const {id} of templates.filter(template=>template.status==='planned'))assert.throws(()=>getTemplate(id,{availableOnly:true}),/direncanakan/);
  assert.equal(getTemplate('ecommerce',{availableOnly:true}).id,'commerce');
});
test('available template manifests match registry',async()=>{
  for(const template of templates.filter(t=>t.status==='available')){
    const manifest=JSON.parse(await readFile(new URL(`../../../${template.directory}/template.json`,import.meta.url),'utf8'));
    assert.equal(manifest.id,template.id);assert.equal(manifest.status,template.status);assert.deepEqual(manifest.presets,Object.keys(template.presets));
  }
});
test('all checked-in manifests satisfy the shared schema',async()=>{
  const schema=JSON.parse(await readFile(new URL('../template.schema.json',import.meta.url),'utf8'));
  const validate=addFormats(new Ajv2020()).compile(schema);
  const root=new URL('../../../templates/',import.meta.url);
  let count=0;
  for(const entry of await readdir(root,{withFileTypes:true})){
    if(!entry.isDirectory())continue;
    let contents;
    try{contents=await readFile(new URL(`${entry.name}/template.json`,root),'utf8');}catch(error){if(error.code==='ENOENT')continue;throw error;}
    const manifest=JSON.parse(contents);
    assert.ok(validate(manifest),`${entry.name}: ${JSON.stringify(validate.errors)}`);
    count++;
  }
  assert.equal(count,templates.length);
  const school=JSON.parse(await readFile(new URL('school/template.json',root),'utf8'));
  assert.equal(validate({...school,unknownAxis:[]}),false);
  assert.equal(validate({...school,layouts:['Invalid axis']}),false);
  assert.equal(validate({...school,palettes:['cobalt','cobalt']}),false);
});
test('package export map supports strict TypeScript consumers and matching runtime exports',async()=>{
  const require=createRequire(import.meta.url);
  execFileSync(process.execPath,[join(dirname(require.resolve('typescript/package.json')),'bin/tsc'),'--noEmit','--strict','--module','NodeNext','--moduleResolution','NodeNext','--target','ES2022',fileURLToPath(new URL('./consumer.mts',import.meta.url))],{stdio:'pipe'});
  const runtime=await import('@tampiloka/registry');
  const expected=['bookingLayouts','bookingLevels','bookingPalettes','bookingPresets','cafePresets','capabilitiesFor','commerceFeatureIds','commerceFeatureLabels','commerceLevels','commerceModulesFor','commercePresets','getTemplate','schoolLayouts','schoolLevels','schoolModuleIds','schoolModulesFor','schoolPalettes','schoolPresets','schoolTemplate','schoolTypography','templates'];
  assert.deepEqual(Object.keys(runtime).sort(),expected.sort());
});
