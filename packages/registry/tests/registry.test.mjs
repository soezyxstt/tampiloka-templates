import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
  for(const id of ['dashboard','school','booking'])assert.throws(()=>getTemplate(id,{availableOnly:true}),/direncanakan/);
  assert.equal(getTemplate('ecommerce',{availableOnly:true}).id,'commerce');
});
test('available template manifests match registry',async()=>{
  for(const template of templates.filter(t=>t.status==='available')){
    const manifest=JSON.parse(await readFile(new URL(`../../../${template.directory}/template.json`,import.meta.url),'utf8'));
    assert.equal(manifest.id,template.id);assert.equal(manifest.status,template.status);assert.deepEqual(manifest.presets,Object.keys(template.presets));
  }
});
