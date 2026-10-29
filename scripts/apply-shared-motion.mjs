import {readFile,writeFile,rm} from 'node:fs/promises';
import assert from 'node:assert/strict';
import ts from 'typescript';
const edit=async(path,fn)=>{const before=await readFile(path,'utf8');const after=fn(before);assert.notEqual(after,before,'No change: '+path);await writeFile(path,after);};
function replace(source,from,to){assert.ok(source.includes(from),'Missing source: '+from.slice(0,140));return source.replace(from,to);}
await edit('app/globals.css',s=>replace(s,'@import "../components/ui/workspace.css";','@import "../components/ui/workspace.css";\n@import "../components/ui/motion.css";'));
await edit('app/layout.tsx',s=>replace(replace(s,"import './globals.css';","import './globals.css';\nimport { MotionProvider } from '@/components/ui/motion';"),'<body className="min-h-screen antialiased">{children}</body>','<body className="min-h-screen antialiased"><MotionProvider>{children}</MotionProvider></body>'));
await edit('demos/main.tsx',s=>replace(replace(replace(s,"import './showcase.css';","import './showcase.css';\nimport { MotionProvider } from '../components/ui/motion';"),".render(activeDemo",".render(<MotionProvider>{activeDemo"),': <DemoPortal demos={portalDemos()} baseDomain={DEMO_DOMAIN} />);',': <DemoPortal demos={portalDemos()} baseDomain={DEMO_DOMAIN} />}</MotionProvider>);'));
await edit('components/cafe/ui-primitives.tsx',s=>{
 s=replace(s,"import * as DialogPrimitive from '@radix-ui/react-dialog';","import { Dialog, DialogContent, DialogClose, DialogTitle, DialogDescription } from '@/components/ui/dialog';\nimport { RevealText } from '@/components/ui/motion';");
 s=replace(s,'motion, AnimatePresence, useReducedMotion','motion, AnimatePresence');
 s=replace(s,'        {title}\n      </h1>','        <RevealText key={title}>{title}</RevealText>\n      </h1>');
 s=replace(s,"  const shouldReduceMotion = useReducedMotion();\n  const descriptionId = React.useId();","  const descriptionId = React.useId();\n  const opener = React.useRef<HTMLElement | null>(null);\n  React.useLayoutEffect(() => { if (open && document.activeElement instanceof HTMLElement) opener.current = document.activeElement; }, [open]);");
 const start=s.indexOf('    <DialogPrimitive.Root open={open}');const end=s.indexOf('    </DialogPrimitive.Root>',start);
 assert.ok(start>0&&end>start);
 s=s.slice(0,start)+`    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent aria-describedby={srDescription ? descriptionId : undefined} className={maxWidth} onCloseAutoFocus={(event) => {
        if (opener.current?.isConnected) { event.preventDefault(); opener.current.focus({ preventScroll: true }); }
      }}>
        <div className="flex justify-center pt-3 sm:hidden" aria-hidden="true"><div className="h-1 w-10 rounded-full bg-[var(--border-strong)]" /></div>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <DialogTitle className="font-heading text-lg font-semibold tracking-tight"><RevealText>{title}</RevealText></DialogTitle>
          <DialogClose asChild><Button type="button" variant="ghost" size="icon" aria-label="Tutup"><X className="h-5 w-5" /></Button></DialogClose>
        </div>
        {srDescription && <DialogDescription id={descriptionId} className="sr-only">{srDescription}</DialogDescription>}
        <div className="space-y-4 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </DialogContent>
    </Dialog>`+s.slice(end+'    </DialogPrimitive.Root>'.length);
 return s;
});
// AST-scoped rewrites preserve every form, command, key and event handler.
for(const [path,kind]of [['components/cafe/customer-app.tsx','customer'],['components/cafe/staff-app.tsx','staff']]){
 await edit(path,source=>{
  const file=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const edits=[];let panels=0;
  const add=(start,end,text)=>edits.push({start,end,text});
  function walk(n){
   if(ts.isJsxElement(n)){
    const open=n.openingElement,tag=open.tagName.getText(file);
    const attrs=open.attributes.properties;
    const key=attrs.find(a=>ts.isJsxAttribute(a)&&a.name.getText(file)==='key');
    const keyText=key?.initializer&&ts.isStringLiteral(key.initializer)?key.initializer.text:'';
    if(tag==='motion.div'&&keyText.startsWith(kind==='customer'?'screen-':'pos-')){
     panels++;const next=kind==='customer'?'MotionPanel':'div';
     add(open.tagName.getStart(file),open.tagName.end,next);add(n.closingElement.tagName.getStart(file),n.closingElement.tagName.end,next);
     for(const a of attrs)if(ts.isJsxAttribute(a)&&['initial','animate','exit','transition'].includes(a.name.getText(file)))add(a.pos,a.end,'');
    }
    if(kind==='staff'&&tag==='main'&&attrs.some(a=>ts.isJsxAttribute(a)&&a.name.getText(file)==='id'&&a.initializer?.text==='staff-content')){
     const sections=n.children.filter(c=>ts.isJsxExpression(c)&&c.expression?.getText(file).startsWith('sectionEnabled('));
     assert.equal(sections.length,6,'Expected all six staff screens');
     add(sections[0].getStart(file),sections[0].getStart(file),'<AnimatePresence mode="wait" initial={false}><MotionPanel key={activeSection}>');
     add(sections.at(-1).end,sections.at(-1).end,'</MotionPanel></AnimatePresence>');
    }
    if(kind==='customer'&&tag==='div'&&attrs.some(a=>ts.isJsxAttribute(a)&&a.name.getText(file)==='className'&&a.initializer?.getText(file)==='{styles.menuGrid}')){
     add(open.end,open.end,'<AnimatePresence initial={false} mode="popLayout">');
     add(n.closingElement.getStart(file),n.closingElement.getStart(file),'</AnimatePresence>');
    }
    if(kind==='customer'&&tag==='article'&&keyText===''&&key?.initializer?.getText(file)==='{item.id}'&&attrs.some(a=>a.getText(file).includes('styles.menuCard'))){
     add(open.tagName.getStart(file),open.tagName.end,'MotionItem');add(n.closingElement.tagName.getStart(file),n.closingElement.tagName.end,'MotionItem');
     add(open.tagName.end,open.tagName.end,' order={itemIndex}');
    }
   }
   ts.forEachChild(n,walk);
  }
  walk(file);assert.ok(panels>=6,'Too few '+kind+' screens: '+panels);
  for(const e of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+e.text+source.slice(e.end);
  source=replace(source,"import { motion, AnimatePresence",`import { MotionPanel${kind==='customer'?', MotionItem':''} } from '@/components/ui/motion';\nimport { motion, AnimatePresence`);
  if(kind==='customer')source=replace(source,'filteredCatalog.map((item: any) =>','filteredCatalog.map((item: any, itemIndex: number) =>');
  console.log('Shared motion screens',kind,panels);return source;
 });
}
await edit('components/ui/choice-strip.tsx',s=>{
 s=replace(s,"import { Button } from './button';","import { Button } from './button';\nimport { motion, useReducedMotion } from 'motion/react';\nimport { MOTION } from './motion';");
 s=replace(s,"  const Container = kind === 'navigation' ? 'nav' : 'div';",`  const Container = kind === 'navigation' ? 'nav' : 'div';
  const reduce = useReducedMotion();
  const [indicator, setIndicator] = React.useState<{ x:number; width:number } | null>(null);
  React.useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    let live = true;
    const measure = () => {
      if (!live) return;
      const active = el.querySelector<HTMLElement>('button[data-active]');
      if (!active) { setIndicator(null); return; }
      const next = { x: active.offsetLeft, width: active.offsetWidth };
      setIndicator(old => old?.x === next.x && old?.width === next.width ? old : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.querySelectorAll('button[data-choice]').forEach(button => observer.observe(button));
    void document.fonts.ready.then(measure);
    return () => { live = false; observer.disconnect(); };
  }, [items, value, variant]);`);
 s=replace(s,'data-ui="choice-strip" data-variant={variant}','data-ui="choice-strip" data-motion-indicator={indicator ? "true" : undefined} data-variant={variant}');
 s=replace(s,'    {items.map(item => {','    {indicator && <motion.span aria-hidden="true" data-ui="choice-indicator" className="choice-indicator" initial={false} animate={indicator} transition={{ type: \'tween\', duration: reduce ? 0 : MOTION.enter, ease: MOTION.ease }} />}\n    {items.map(item => {');
 return s;
});
await edit('components/ui/select.tsx',s=>{
 s=replace(s,'<SelectPrimitive.Trigger\n    ref={ref}','<SelectPrimitive.Trigger\n    data-ui="select-trigger"\n    ref={ref}');
 s=replace(s,'<SelectPrimitive.Content\n      ref={ref}','<SelectPrimitive.Content\n      data-ui="select-content"\n      ref={ref}');
 s=s.replace(' data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95','');return s;
});
await edit('scripts/demos-verify.mjs',s=>replace(s,"['tests/demos-compact-ui.mjs'","['tests/demos-motion.mjs', 'tests/demos-compact-ui.mjs'"));
await edit('scripts/demos-live-verify.mjs',s=>replace(s,"for(const [script,extra] of [","for(const [script,extra] of [\n ['tests/demos-motion.mjs',{CAFE_MOTION_OUTPUT:'test-results/motion-live'}],"));
await rm('scripts/apply-shared-motion.mjs');await rm('.github/workflows/apply-shared-motion.yml');
console.log('Shared motion changes prepared; no transaction logic changed.');
