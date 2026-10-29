import { readFile, writeFile, readdir, mkdir, lstat, realpath, rename, rm, rmdir, copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, basename, resolve, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const VERSION = '1.0.0';
const HERE = dirname(fileURLToPath(import.meta.url));
const BOOL = new Set(['yes', 'json', 'dry-run', 'help', 'version']);
const VALUES = new Set(['template','preset','level','layout','theme','card','button','name','phone','whatsapp','color','features','out','dir']);
const HELP = `Tampiloka ${VERSION}

Usage:
  tampiloka create <project-name> [options]  Buat proyek klien baru
  tampiloka list [--json]                   Lihat template dan statusnya
  tampiloka presets [template] [--json]     Lihat preset dan level fitur
  tampiloka doctor [--dir <path>] [--json]  Periksa proyek yang sudah dibuat

Pilihan create:
  --template <id>  cafe atau commerce
  --preset <id>    Susunan tampilan atau paket cafe
  --level <id>     commerce: catalog, whatsapp, store, advanced
  --features <ids> commerce: promotions,taxes,service-fees,customer-accounts,loyalty-points,membership-tiers; none atau all
  --layout <id>    commerce: editorial, market, atelier, compact
  --theme <id>     commerce: sand, ink, forest; cafe: boxy, rounded, editorial, playful, airy
  --card <id>      commerce: open, framed, soft
  --button <id>    commerce: solid, outline
  --name <text>    Nama brand
  --whatsapp <text> WhatsApp bisnis, format 628... (--phone juga diterima)
  --color <hex>    Warna brand cafe, contoh '#234C39'
  --out <path>    Folder induk proyek; bawaan folder saat ini
  --yes           Gunakan nilai bawaan tanpa pertanyaan
  --dry-run       Tampilkan hasil pilihan tanpa menulis file
  --json          Hasil untuk skrip
  --help          Bantuan

Contoh:
  tampiloka create kopi-senja
  tampiloka create rupa --template commerce --preset atelier --level store --features promotions,taxes --yes
  tampiloka create katalog --template commerce --level whatsapp --phone 628123456789 --yes
  tampiloka create kedai --template cafe --preset full --theme editorial --yes

Tanpa --yes, terminal interaktif menanyakan template, preset, dan pilihan desain.
Level fitur commerce terpisah dari desain. Dashboard, school, dan booking masih
direncanakan. CLI tidak membuat proyek yang belum punya implementasi.
`;

export function parseArguments(argv) {
  const options = {}, positionals = [];
  for (let i=0;i<argv.length;i++) {
    const arg=argv[i];
    if(arg==='-h'){options.help=true;continue;}
    if(arg==='-v'){options.version=true;continue;}
    if(!arg.startsWith('--')) { if(arg.startsWith('-'))throw new Error(`Opsi tidak dikenal: ${arg}.`); positionals.push(arg); continue; }
    const [key,...inline]=arg.slice(2).split('=');
    if(!BOOL.has(key)&&!VALUES.has(key))throw new Error(`Opsi tidak dikenal: --${key}. Lihat --help.`);
    if(Object.hasOwn(options,key))throw new Error(`Opsi --${key} muncul dua kali.`);
    if(BOOL.has(key)){if(inline.length)throw new Error(`--${key} tidak menerima nilai.`);options[key]=true;continue;}
    const value=inline.length?inline.join('='):argv[++i];
    if(!value||value.startsWith('--'))throw new Error(`--${key} perlu nilai.`);
    options[key]=value;
  }
  const command=positionals.shift()||'help';
  if(!['create','list','presets','doctor','help'].includes(command))throw new Error(`Perintah tidak dikenal: ${command}.`);
  if(positionals.length>(['create','presets'].includes(command)?1:0))throw new Error('Terlalu banyak argumen. Lihat --help.');
  const allowed=command==='create'?new Set([...BOOL,...VALUES].filter(key=>key!=='dir')):command==='doctor'?new Set(['dir','json','help','version']):new Set(['template','json','help','version']);
  for(const key of Object.keys(options))if(!allowed.has(key))throw new Error(`--${key} tidak berlaku untuk ${command}.`);
  return {command,target:positionals[0],options};
}
async function exists(path) { try{await lstat(path);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;} }
export async function findSourceRoot() {
  const root=resolve(HERE,'../../..');
  if(await exists(join(root,'packages/registry/src/index.mjs')))return root;
  const payload=resolve(HERE,'../payload');
  if(await exists(join(payload,'packages/registry/src/index.mjs')))return payload;
  throw new Error('Sumber template tidak ditemukan. Instal ulang paket CLI lengkap atau jalankan dari repo tampiloka-templates.');
}
const json = async path => JSON.parse(await readFile(path,'utf8'));
const writeJson = async (path,value) => { await mkdir(dirname(path),{recursive:true}); await writeFile(path,`${JSON.stringify(value,null,2)}\n`); };
function emit(options,value,message) { stdout.write(options.json?`${JSON.stringify(value,null,2)}\n`:`${message}\n`); }
function assertChoice(value, allowed, label) { if(!allowed.includes(value))throw new Error(`${label} "${value}" tidak ada. Pilih: ${allowed.join(', ')}.`); }

async function interactive(options, registry) {
  const result={...options};
  if(options.yes||options.json||!stdin.isTTY||!stdout.isTTY)return result;
  const prompt=createInterface({input:stdin,output:stdout});
  const choose=async(label,values,fallback)=>{
    stdout.write(`\n${label}\n`);values.forEach(([id,description],i)=>stdout.write(`  ${i+1}. ${id.padEnd(18)} ${description}\n`));
    while(true){let answer=(await prompt.question(`Pilih [${fallback}]: `)).trim()||fallback;
      if(/^\d+$/.test(answer))answer=values[Number(answer)-1]?.[0]||answer;
      if(values.some(([id])=>id===answer))return answer;stdout.write('Pilihan belum cocok. Masukkan nomor atau nama.\n');}
  };
  try {
    if(!result.template)result.template=await choose('Template',registry.templates.filter(t=>t.status==='available').map(t=>[t.id,t.description]),'commerce');
    const template=registry.getTemplate(result.template,{availableOnly:true});
    if(!result.preset)result.preset=await choose('Preset',Object.entries(template.presets).map(([id,item])=>[id,item.description]),template.defaultPreset);
    if(template.id==='commerce'){
      if(!result.level)result.level=await choose('Kelengkapan fitur',Object.entries(registry.commerceLevels).map(([id,item])=>[id,item.description]),'store');
      if(!result.layout)result.layout=await choose('Susunan halaman',[['editorial','Foto pembuka dan koleksi terbuka'],['market','Kategori dan grid padat'],['atelier','Galeri koleksi beragam'],['compact','Daftar belanja ringkas']],result.preset);
      if(!result.theme)result.theme=await choose('Warna contoh (bisa diganti sesuai brand)',[['sand','Netral hangat'],['ink','Hitam dan putih'],['forest','Hijau dan permukaan terang']],template.presets[result.preset].palette);
      if(!result.card)result.card=await choose('Kartu produk',[['open','Tanpa bingkai'],['framed','Garis tepi'],['soft','Permukaan lembut']],template.presets[result.preset].card);
      if(!result.button)result.button=await choose('Tombol utama',[['solid','Warna isi'],['outline','Garis tepi']],template.presets[result.preset].button);
      if(!result.features)result.features=(await prompt.question('Modul tambahan (pisahkan koma; Enter memakai bawaan level): ')).trim()||undefined;
    } else if(!result.theme)result.theme=await choose('Tema cafe',[['boxy','Tegas'],['rounded','Sudut lembut'],['editorial','Tipografi editorial'],['playful','Garis dan bayangan kuat'],['airy','Ruang longgar']],'rounded');
    if(!result.name)result.name=(await prompt.question('Nama brand (Enter memakai nama proyek): ')).trim()||undefined;
    if(!result.phone)result.phone=(await prompt.question('WhatsApp bisnis 628... (boleh kosong): ')).trim()||undefined;
    return result;
  } finally {prompt.close();}
}

const EXCLUDE_DIRS=new Set(['node_modules','.git','.next','.local','.data','.wrangler','.turbo','dist','dist-demos','dist-worker','build','coverage','test-results','playwright-report','design-runs','payload']);
const ROOT_DIRS=new Set(['src','worker','migrations','content','config','public','scripts','tests','docs']);
const ROOT_FILES=new Set(['package.json','tsconfig.json','tsconfig.node.json','vite.config.ts','vite.config.mts','wrangler.json','wrangler.jsonc','wrangler.toml','index.html','README.md','eslint.config.mjs','.gitignore','.env.example','.dev.vars.example']);
export async function copyTree(source,destination,{template=false}={}) {
  async function walk(from,to,depth){
    await mkdir(to,{recursive:true});
    for(const entry of await readdir(from,{withFileTypes:true})){
      if(entry.isSymbolicLink()||EXCLUDE_DIRS.has(entry.name))continue;
      if(/^wrangler\.demo\.(?:jsonc?|toml)$/.test(entry.name))continue;
      if(entry.name.startsWith('.')&&!['.gitignore','.env.example','.dev.vars.example'].includes(entry.name))continue;
      if(/\.(?:pem|key|p12|pfx|db|sqlite|sqlite3|log|tsbuildinfo)$/.test(entry.name)||/^(?:credentials|service[-_]account)/i.test(entry.name))continue;
      if(template&&depth===0&&!(entry.isDirectory()?ROOT_DIRS:ROOT_FILES).has(entry.name))continue;
      const input=join(from,entry.name),output=join(to,entry.name);
      if(entry.isDirectory())await walk(input,output,depth+1);
      else if(entry.isFile())await copyFile(input,output,constants.COPYFILE_EXCL);
    }
  }
  await walk(source,destination,0);
}
async function normalizeDependencies(root,pkg,packages,nested=false){
  for(const field of ['dependencies','devDependencies','optionalDependencies','peerDependencies'])for(const [name,version] of Object.entries(pkg[field]||{})){
    if(name.startsWith('@tampiloka/')){
      const id=name.slice('@tampiloka/'.length);
      if(!packages.includes(id))throw new Error(`Paket bersama ${id} belum masuk manifest template.`);
      pkg[field][name]=`file:${nested?'../':'./packages/'}${id}`;
    }else if(typeof version==='string'&&version.startsWith('workspace:'))throw new Error(`Dependensi workspace tak dikenal: ${name}.`);
  }
  await writeJson(join(root,'package.json'),pkg);
}
async function createCommerce(sourceRoot,temp,target,options,template) {
  const source=join(sourceRoot,template.directory),manifest=await json(join(source,'template.json'));
  await copyTree(source,temp,{template:true});
  const pkg=await json(join(temp,'package.json'));pkg.name=target;pkg.version='1.0.0';pkg.private=true;delete pkg.repository;
  pkg.packageManager='pnpm@10.28.2';
  pkg.pnpm={...pkg.pnpm,onlyBuiltDependencies:['esbuild','workerd']};
  pkg.scripts={...pkg.scripts};
  for(const id of ['deploy:demo'])delete pkg.scripts[id];
  const shared=manifest.sharedPackages||[];
  for(const id of shared){
    const dest=join(temp,'packages',id);await copyTree(join(sourceRoot,'packages',id),dest);
    const dependency=await json(join(dest,'package.json'));delete dependency.scripts;
    await normalizeDependencies(dest,dependency,shared,true);
  }
  await normalizeDependencies(temp,pkg,shared);
  const registry=await import(pathToFileURL(join(sourceRoot,'packages/registry/src/index.mjs')).href);
  const chosen=registry.commercePresets[options.preset];
  const config=await json(join(temp,'config/commerce.json'));
  config.brand={...config.brand,name:options.name||target,whatsapp:options.phone||'',email:'',address:'',description:'',tagline:''};
  config.level=options.level;config.preset=options.preset;
   config.modules=registry.commerceModulesFor(options.level,options.features);
  config.appearance={layout:options.layout||chosen.layout,palette:options.theme||chosen.palette,card:options.card||chosen.card,button:options.button||chosen.button};
  config.bank={name:'',accountNumber:'',accountHolder:''};
  await writeJson(join(temp,'config/commerce.json'),config);
  const wranglerFile=['wrangler.jsonc','wrangler.json'].find(file=>ROOT_FILES.has(file)&&file); // Prefer the source file that exists.
  let wranglerPath=join(temp,wranglerFile);
  if(!await exists(wranglerPath))wranglerPath=join(temp,'wrangler.json');
  if(await exists(wranglerPath)){
    const raw=await readFile(wranglerPath,'utf8');
    let wrangler;try{wrangler=JSON.parse(raw);}catch{throw new Error('wrangler config harus JSON tanpa komentar untuk generator.');}
    wrangler.name=target;delete wrangler.routes;delete wrangler.account_id;
    wrangler.vars={...wrangler.vars,DEMO_MODE:'false'};delete wrangler.vars.COMMERCE_LEVEL;
    if(wrangler.d1_databases)wrangler.d1_databases=wrangler.d1_databases.map(db=>({...db,database_name:`${target}-db`,database_id:'00000000-0000-0000-0000-000000000000'}));
    await writeJson(wranglerPath,wrangler);
  }
  await writeFile(join(temp,'.dev.vars.example'),'# Salin ke .dev.vars untuk menjalankan demo lokal. Jangan commit rahasia.\nDEMO_MODE=true\n# STAFF_OWNER_PASSWORD=gunakan-password-panjang-dan-unik\n# MIDTRANS_SERVER_KEY=\n# MIDTRANS_ENVIRONMENT=sandbox\n# RESEND_API_KEY=\n# MEMBER_EMAIL_FROM=Halo Toko <member@domain-toko.com>\n');
  await writeFile(join(temp,'CLIENT_SETUP.md'),`# ${options.name||target}\n\nTemplate commerce Tampiloka. Level: ${options.level}. Preset: ${options.preset}.\n\n## Jalankan lokal\n\n1. \`pnpm install\`\n2. \`cp .dev.vars.example .dev.vars\`\n3. \`pnpm dev\`\n\nDemo lokal terpisah dari produksi. Data produk awal adalah contoh. Ganti konten, foto, nomor WhatsApp, bank, dan ongkir sebelum menerima pesanan nyata.\n\n## Deploy toko\n\nBuat database D1 milik klien, isi ID-nya di wrangler.jsonc, lalu jalankan migrasi. Set DEMO_MODE=false pada deploy produksi. Simpan password staf dan kunci gateway dengan \`wrangler secret put\`. Jangan masukkan kunci ke config/commerce.json. Baca docs/api.md dan README.md untuk perintah deploy serta batas integrasi.\n\nPaket bersama ada di packages/ milik proyek ini. Proyek tidak bergantung pada checkout monorepo atau paket workspace tersembunyi.\n`);
  return config;
}

export async function createProject(target,initial,sourceRoot,registry) {
  if(!target||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target)||target.length>63)throw new Error('Nama proyek harus 1-63 huruf kecil/angka dengan tanda hubung, contoh kopi-senja. Gunakan --out untuk memilih folder induk.');
  if(initial.phone&&initial.whatsapp)throw new Error('Gunakan --whatsapp atau --phone, bukan keduanya.');
  const options=await interactive({...initial,phone:initial.whatsapp||initial.phone},registry);
  const template=registry.getTemplate(options.template||'commerce',{availableOnly:true});
  options.template=template.id;options.preset=options.preset||template.defaultPreset;
  assertChoice(options.preset,Object.keys(template.presets),'Preset');
  if(options.name&&(options.name.length>80||/[\u0000-\u001f]/.test(options.name)))throw new Error('Nama brand maksimal 80 karakter tanpa karakter kontrol.');
  if(options.phone&&!/^62\d{8,13}$/.test(options.phone))throw new Error('WhatsApp gunakan format 628..., tanpa spasi atau tanda +.');
  if(template.id==='commerce'){
    options.level=options.level||template.defaultLevel;
    assertChoice(options.level,Object.keys(registry.commerceLevels),'Level');
    registry.commerceModulesFor(options.level,options.features);
    if(options.layout)assertChoice(options.layout,Object.keys(registry.commercePresets),'Layout');
    if(options.theme)assertChoice(options.theme,['sand','ink','forest'],'Tema');
    if(options.card)assertChoice(options.card,['open','framed','soft'],'Kartu');
    if(options.button)assertChoice(options.button,['solid','outline'],'Tombol');
    if(options.color)throw new Error('--color hanya untuk cafe. Untuk commerce ubah token brand di config dan CSS proyek.');
  } else {
    for(const key of ['level','layout','card','button','features'])if(options[key])throw new Error(`--${key} hanya berlaku untuk commerce.`);
    if(options.theme)assertChoice(options.theme,['boxy','rounded','editorial','playful','airy'],'Tema');
    if(options.color&&!/^#[\da-f]{6}$/i.test(options.color))throw new Error('Warna brand harus #RRGGBB.');
  }
  const parent=resolve(options.out||process.cwd()),destination=join(parent,target);
  if(await exists(destination))throw new Error(`Folder sudah ada: ${destination}. CLI tidak menimpa proyek.`);
  // Canonical parent prevents a symlink from turning a seemingly external path into the source template.
  let ancestor=parent;while(!await exists(ancestor))ancestor=dirname(ancestor);
  const canonical=join(await realpath(ancestor),relative(ancestor,parent),target),source=await realpath(sourceRoot);
  if(canonical===source||canonical.startsWith(join(source,'templates')+sep)||canonical.startsWith(join(source,'packages')+sep))throw new Error('Buat proyek klien di luar folder sumber templates/ dan packages/.');
  const result={command:'create',dryRun:Boolean(options['dry-run']),template:template.id,preset:options.preset,...(options.level?{level:options.level}:{}),...(template.id==='commerce'?{modules:registry.commerceModulesFor(options.level,options.features)}:{}),directory:destination};
  if(options['dry-run']){emit(options,result,`Rencana proyek ${destination}\n${template.id} / ${options.preset}${options.level?` / ${options.level}`:''}\nTidak ada file yang ditulis.`);return result;}
  await mkdir(parent,{recursive:true});
  const temp=join(parent,`.tampiloka-${target}-${randomUUID()}`);
  let reservedDestination=false;
  try {
    if(template.id==='cafe'){
      const args=[join(sourceRoot,'templates/cafe/scripts/cafe.mjs'),'init',temp,'--name',options.name||target,'--slug',target,'--preset',options.preset,'--yes','--json'];
      for(const key of ['theme','phone','color'])if(options[key])args.push(`--${key}`,options[key]);
      const run=spawnSync(process.execPath,args,{encoding:'utf8'});
      if(run.error)throw run.error;
      if(run.status!==0)throw new Error(run.stderr.trim()||'Pembuatan cafe gagal.');
    }else await createCommerce(sourceRoot,temp,target,options,template);
    await writeJson(join(temp,'tampiloka.project.json'),{schemaVersion:1,template:template.id,preset:options.preset,level:options.level||null,...(template.id==='commerce'?{modules:registry.commerceModulesFor(options.level,options.features)}:{}),cliVersion:VERSION,createdAt:new Date().toISOString(),source:'soezyxstt/tampiloka-templates'});
    // Reserve the destination atomically. rename alone may replace an existing empty directory.
    await mkdir(destination);
    reservedDestination=true;
    await rename(temp,destination);
    reservedDestination=false;
  }catch(error){await rm(temp,{recursive:true,force:true});if(reservedDestination)await rmdir(destination).catch(()=>{});throw error;}
  const shellDestination = "'" + destination.replaceAll("'", "'\"'\"'") + "'";
  emit(options,result,`Proyek siap: ${destination}\nTemplate: ${template.id} · Preset: ${options.preset}${options.level?` · Level: ${options.level}`:''}\n\nBerikutnya:\n  cd ${shellDestination}\n  ${template.id==='cafe'?'npm ci\n  npm run demo':'pnpm install\n  cp .dev.vars.example .dev.vars\n  pnpm dev'}\n\nPeriksa: tampiloka doctor --dir ${shellDestination}\nPanduan klien ada di ${template.id==='cafe'?'docs/client-setup.md':'CLIENT_SETUP.md'}.`);
  return result;
}

export async function doctor(options,sourceRoot,registry) {
  const directory=resolve(options.dir||process.cwd()),checks=[];
  if(directory===resolve(sourceRoot)&&await exists(join(directory,'pnpm-workspace.yaml'))){
    for(const item of registry.templates.filter(t=>t.status==='available'))checks.push({name:item.id,status:await exists(join(directory,item.directory,'package.json'))?'pass':'fail',detail:item.directory});
    checks.push({name:'Lockfile',status:await exists(join(directory,'pnpm-lock.yaml'))?'pass':'warn',detail:'pnpm-lock.yaml'});
    checks.push({name:'CLI',status:'pass',detail:'Buat proyek dengan tampiloka create nama-proyek.'});
    const result={command:'doctor',ok:checks.every(c=>c.status!=='fail'),directory,template:'monorepo',checks};
    emit(options,result,checks.map(c=>`${c.status.toUpperCase().padEnd(4)} ${c.name}: ${c.detail}`).join('\n'));if(!result.ok)process.exitCode=1;return result;
  }
  if(!await exists(join(directory,'tampiloka.project.json')))throw new Error('tampiloka.project.json tidak ditemukan. Jalankan di proyek hasil tampiloka create atau beri --dir.');
  const project=await json(join(directory,'tampiloka.project.json')),template=registry.getTemplate(project.template,{availableOnly:true});
  if(template.id==='cafe'){
    const child=spawnSync(process.execPath,[join(directory,'scripts/cafe.mjs'),'doctor','--dir',directory,'--json'],{encoding:'utf8'});
    if(child.error)throw child.error;
    let result;try{result=JSON.parse(child.stdout);}catch{throw new Error(child.stderr||'Pemeriksaan cafe gagal.');}
    emit(options,result,result.checks.map(c=>`${c.status.toUpperCase()} ${c.name}: ${c.detail}`).join('\n'));if(child.status)process.exitCode=child.status;return result;
  }
  const config=await json(join(directory,'config/commerce.json')),pkg=await json(join(directory,'package.json'));
  try{assertChoice(config.level,Object.keys(registry.commerceLevels),'Level');assertChoice(config.preset,Object.keys(registry.commercePresets),'Preset');if(config.modules){for(const id of Object.keys(config.modules)){if(!registry.commerceFeatureIds.includes(id)||typeof config.modules[id]!=='boolean')throw new Error('Modul tidak dikenal: '+id);}if(config.modules.loyaltyPoints&&!config.modules.customerAccounts)throw new Error('Poin membutuhkan akun pelanggan.');if(config.modules.membershipTiers&&!config.modules.loyaltyPoints)throw new Error('Membership membutuhkan poin.');if(['catalog','whatsapp'].includes(config.level)&&Object.values(config.modules).some(Boolean))throw new Error('Modul checkout tidak tersedia pada level ini.');}checks.push({name:'Konfigurasi',status:'pass',detail:`${config.level} / ${config.preset}`});}catch(error){checks.push({name:'Konfigurasi',status:'fail',detail:error.message});}
  const unresolved=Object.values({...pkg.dependencies,...pkg.devDependencies}).some(v=>typeof v==='string'&&v.startsWith('workspace:'));
  checks.push({name:'Proyek mandiri',status:unresolved?'fail':'pass',detail:unresolved?'Ada dependensi workspace yang belum disalin.':'Tidak bergantung pada workspace induk.'});
  for(const [name,value]of Object.entries({...pkg.dependencies,...pkg.devDependencies}))if(typeof value==='string'&&value.startsWith('file:'))checks.push({name, status:await exists(join(directory,value.slice(5),'package.json'))?'pass':'fail',detail:value});
  if(['catalog','whatsapp'].includes(config.level))checks.push({name:'Kontak WhatsApp',status:config.brand.whatsapp?'pass':'warn',detail:config.brand.whatsapp||'Isi brand.whatsapp sebelum melayani pelanggan.'});
  if(['store','advanced'].includes(config.level))checks.push({name:'Bank transfer',status:config.bank.accountNumber?'pass':'warn',detail:config.bank.accountNumber?'Periksa nama dan nomor rekening sebelum menerima pembayaran.':'Isi bank atau gunakan COD; transfer belum siap.'});
  if(config.modules?.customerAccounts)checks.push({name:'Email member',status:'warn',detail:'Pasang RESEND_API_KEY dan MEMBER_EMAIL_FROM dari domain pengirim terverifikasi sebelum menggunakan akun member produksi.'});
  if(config.modules?.taxes && !(config.pricing?.taxBps>0))checks.push({name:'Tarif pajak',status:'warn',detail:'Modul pajak aktif, tetapi tarif masih nol. Periksa kewajiban pajak merchant.'});
  checks.push({name:'Produksi',status:'warn',detail:'Verifikasi database D1, DEMO_MODE=false, password staf, data produk, pengiriman, dan kunci gateway sebelum menerima transaksi nyata.'});
  const ok=checks.every(check=>check.status!=='fail'),result={command:'doctor',ok,directory,template:template.id,checks};
  emit(options,result,checks.map(c=>`${c.status.toUpperCase().padEnd(4)} ${c.name}: ${c.detail}`).join('\n'));if(!ok)process.exitCode=1;return result;
}

export async function main(argv) {
  const {command,target,options}=parseArguments(argv);
  if(options.version){stdout.write(`${VERSION}\n`);return;}
  if(options.help||command==='help'){stdout.write(HELP);return;}
  const sourceRoot=await findSourceRoot(),registry=await import(pathToFileURL(join(sourceRoot,'packages/registry/src/index.mjs')).href);
  if(command==='list'){emit(options,registry.templates,registry.templates.map(t=>`${t.id.padEnd(12)} ${t.status==='available'?'Siap dicoba':'Direncanakan'}\n  ${t.description}`).join('\n'));return;}
  if(command==='presets'){
    const template=registry.getTemplate(target||options.template||'commerce',{availableOnly:true});
    const value={template:template.id,presets:template.presets,levels:template.levels||{},...(template.id==='commerce'?{features:registry.commerceFeatureLabels}:{})};
    emit(options,value,Object.entries(value.presets).map(([id,p])=>`${id.padEnd(22)} ${p.description}`).join('\n')+(template.levels?'\n\nLevel fitur:\n'+Object.entries(template.levels).map(([id,p])=>`${id.padEnd(22)} ${p.description}`).join('\n'):''));return;
  }
  if(command==='create')return createProject(target,options,sourceRoot,registry);
  return doctor(options,sourceRoot,registry);
}
