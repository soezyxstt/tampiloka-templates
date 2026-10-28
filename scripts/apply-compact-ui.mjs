import {readFile,writeFile,rm} from 'node:fs/promises';
import assert from 'node:assert/strict';
const path='tests/demos-compact-ui.mjs';let t=await readFile(path,'utf8');
const anchor='width:innerWidth,scrollWidth:document.documentElement.scrollWidth,';
assert.ok(t.includes(anchor));
t=t.replace(anchor,`width:innerWidth,scrollWidth:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].flatMap(e=>{const r=e.getBoundingClientRect();if(!r.width||r.right<=innerWidth+1)return [];for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){if(['auto','scroll','hidden','clip'].includes(getComputedStyle(p).overflowX))return [];}const s=getComputedStyle(e);return [{tag:e.tagName,cls:typeof e.className==='string'?e.className:'svg',text:e.textContent.slice(0,75),x:r.x,right:r.right,width:r.width,minWidth:s.minWidth,display:s.display,wrap:s.flexWrap,parent:e.parentElement?.className}];}).slice(0,15),`);
await writeFile(path,t);await rm('scripts/apply-compact-ui.mjs');await rm('.github/workflows/ui-apply.yml');
