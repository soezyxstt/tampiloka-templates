import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url)),out=join(root,'test-results');
await mkdir(out,{recursive:true});
const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;await new Promise(resolve=>server.close(resolve));
const vite=fileURLToPath(new URL('./bin/vite.js',import.meta.resolve('vite/package.json')));
const preview=spawn(process.execPath,[vite,'preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:'pipe'});
const url=`http://127.0.0.1:${port}`;
let browser;
const checks=[],errors=[];
try{
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
 browser=await chromium.launch({headless:true});
 for(const width of [320,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.getByRole('heading',{name:'Galeri template'}).waitFor();await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('.demo').count(),13);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`overflow at ${width}`);
  assert.equal(await page.locator('.demo a[href^="https://ecommerce.tampiloka.site/"]').count(),12);
  if([390,1440].includes(width))await page.screenshot({path:join(out,`showcase-${width}.png`),fullPage:true});
  await page.getByRole('button',{name:'Commerce',exact:true}).click();assert.equal(await page.locator('.demo').count(),4);
  await page.getByRole('button',{name:'Keranjang + WhatsApp',exact:true}).click();assert.ok((await page.locator('.demo-preview').first().getAttribute('href')).includes('level=whatsapp'));
  await page.getByRole('textbox',{name:'Cari demo'}).fill('tidak-ada');await page.getByRole('heading',{name:'Belum ada yang cocok.'}).waitFor();
  await page.getByRole('button',{name:'Reset pencarian'}).click();assert.equal(await page.locator('.demo').count(),13);
  await page.getByRole('button',{name:'Cafe & resto',exact:true}).click();assert.equal(await page.locator('.demo').count(),9);
  assert.equal(await page.locator('.levels').count(),0);
  checks.push({width,demos:13,filters:true,search:true,links:true,overflow:false});await page.close();
 }
 assert.deepEqual(errors,[]);await writeFile(join(out,'report.json'),JSON.stringify({url,checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser?.close();preview.kill('SIGTERM');}
