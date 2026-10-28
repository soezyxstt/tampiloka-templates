import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const out='test-results/resize-diagnostic';
await mkdir(out,{recursive:true});
const browser=await chromium.launch();
const results=[];
try {
  for (const preset of ['operations','pos','full']) {
    const context=await browser.newContext({viewport:{width:1920,height:1000},reducedMotion:'reduce'});
    await context.route('**/*',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.abort());
    const page=await context.newPage();
    await page.goto(`https://cafe-${preset}.tampiloka.site/staff`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>{const b=document.querySelector('button[aria-label="Ulangi demo"]');return b&&!b.disabled;},null,{timeout:120000});
    const localOnly=await page.evaluate(async()=>(await(await fetch('/api/v1/snapshot?surface=staff')).json()).data?.runtime?.localOnly);
    if(!localOnly)throw new Error('Not an isolated demo');
    await page.getByRole('button',{name:'Nadia Kusuma Manajer Operasional',exact:true}).click();
    await page.locator('.cafe-staff > header').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    const read=()=>page.evaluate(()=>{
      const details=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,cls:e.getAttribute('class'),text:e.textContent?.slice(0,100),x:r.x,y:r.y,width:r.width,right:r.right,bottom:r.bottom,display:s.display,minWidth:s.minWidth,widthCSS:s.width,overflowX:s.overflowX,position:s.position,transform:s.transform,font:s.font,animation:s.animationName};};
      return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,fontStatus:document.fonts.status,overflows:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1)&&r.y> -10000;}).map(e=>({self:details(e),ancestors:[e.parentElement,e.parentElement?.parentElement,e.parentElement?.parentElement?.parentElement].filter(Boolean).map(details)})).slice(0,80)};
    });
    for(let i=0;i<16;i++){
      await page.setViewportSize({width:1920,height:1000});
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
      await page.waitForTimeout(100);
      await page.setViewportSize({width:390,height:844});
      for(const delay of [0,32,100,400]) {
        if(delay)await page.waitForTimeout(delay);
        const r=await read();
        results.push({preset,iteration:i,delay,...r});
        if(r.scrollWidth>r.width+1)console.log(JSON.stringify({preset,iteration:i,delay,...r}));
      }
    }
    await page.screenshot({path:`${out}/${preset}-390.png`,fullPage:true,animations:'disabled'});
    await context.close();
  }
}finally{await writeFile(`${out}/report.json`,JSON.stringify(results,null,2));await browser.close();}
console.log('samples',results.length,'overflowSamples',results.filter(r=>r.scrollWidth>r.width+1).length);
