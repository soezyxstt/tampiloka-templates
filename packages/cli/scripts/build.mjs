import { mkdir, rm, copyFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyTree } from '../src/index.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../../..'),payload=resolve(here,'../payload');
await rm(payload,{recursive:true,force:true});
await mkdir(payload,{recursive:true});
for(const name of ['registry','theme-engine','ui-core','shared-utils','config'])await copyTree(join(root,'packages',name),join(payload,'packages',name));
for(const name of ['cafe','commerce','school','booking']){
  await copyTree(join(root,'templates',name),join(payload,'templates',name));
  await copyFile(join(root,'templates',name,'template.json'),join(payload,'templates',name,'template.json'));
}
await mkdir(join(payload,'templates/cafe/.github/workflows'),{recursive:true});
await copyFile(join(root,'templates/cafe/.github/workflows/ci.yml'),join(payload,'templates/cafe/.github/workflows/ci.yml'));
process.stdout.write('Paket CLI berisi cafe, commerce, school, booking, registry, dan paket bersama.\n');
