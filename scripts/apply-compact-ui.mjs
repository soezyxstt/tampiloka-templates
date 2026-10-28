import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { dirname } from 'node:path';
const read = path => readFile(path, 'utf8');
const put = async (path, text) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, text); };
const once = (text, old, next, label) => { assert.ok(text.includes(old), `Missing patch anchor: ${label}`); return text.replace(old, next); };
const between = (text, start, end, replacement) => { const a=text.indexOf(start), b=text.indexOf(end,a+start.length); assert.ok(a>=0&&b>a, `Missing block: ${start}`); return text.slice(0,a)+replacement+text.slice(b); };

await put('components/ui/choice-strip.tsx', String.raw`'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface ChoiceItem<T extends string> {
  id: T;
  label: string;
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
}
export interface ChoiceStripProps<T extends string> {
  items: Array<ChoiceItem<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  variant?: 'underline' | 'segmented';
  kind?: 'navigation' | 'filter';
  className?: string;
}
/** One implementation for workspace navigation and mutually exclusive filters.
 * These are navigation/filter buttons, not ARIA tabs without matching panels.
 */
export function ChoiceStrip<T extends string>({ items, value, onChange, ariaLabel, variant='underline', kind='filter', className }: ChoiceStripProps<T>) {
  const root = React.useRef<HTMLDivElement & HTMLElement>(null);
  const Container = kind === 'navigation' ? 'nav' : 'div';
  function keyboard(event: React.KeyboardEvent<HTMLElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('button[data-choice]') || []);
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0 || !buttons.length) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length-1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus({ preventScroll: true });
    // Scroll only this strip, never the document or a sticky header.
    const button = buttons[next], parent = root.current!;
    if (button.offsetLeft < parent.scrollLeft) parent.scrollLeft = button.offsetLeft;
    else if (button.offsetLeft + button.offsetWidth > parent.scrollLeft + parent.clientWidth) parent.scrollLeft = button.offsetLeft + button.offsetWidth - parent.clientWidth;
    onChange(items[next].id);
  }
  return <Container ref={root} role={kind === 'filter' ? 'group' : undefined} aria-label={ariaLabel} data-ui="choice-strip" data-variant={variant} className={cn('choice-strip', className)} onKeyDown={keyboard}>
    {items.map(item => {
      const active = item.id === value, Icon = item.icon;
      return <button key={item.id} type="button" data-choice data-active={active || undefined} aria-current={kind === 'navigation' && active ? 'page' : undefined} aria-pressed={kind === 'filter' ? active : undefined} onClick={() => onChange(item.id)} className="choice-item">
        {Icon && <Icon className="h-4 w-4 shrink-0" />}<span>{item.label}</span>{typeof item.count === 'number' && item.count > 0 && <span className="choice-count">({item.count})</span>}
      </button>;
    })}
  </Container>;
}
/** Independent filters use the same button, without pretending to be tabs. */
export function FilterToggle({ pressed, onPressedChange, children, className, ...props }: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & { pressed: boolean; onPressedChange: (pressed: boolean) => void }) {
  return <Button {...props} size="sm" variant="ghost" className={cn('filter-toggle', className)} aria-pressed={pressed} data-active={pressed || undefined} onClick={() => onPressedChange(!pressed)}>{children}</Button>;
}
`);
await put('components/ui/animated-tabs.tsx', String.raw`'use client';

import { ChoiceStrip, type ChoiceItem } from './choice-strip';
export type AnimatedTabItem<T extends string> = ChoiceItem<T>;
/** Compatibility entry points. Rendering, spacing and keyboard behavior have
 * one source: ChoiceStrip. layoutId remains accepted for existing templates.
 */
export function AnimatedUnderlineTabs<T extends string>({ items, activeId, onSelect, ariaLabel='Navigasi tab', className }: { items: Array<ChoiceItem<T>>; activeId:T; onSelect:(id:T)=>void; layoutId?:string; ariaLabel?:string; className?:string }) {
  return <ChoiceStrip items={items} value={activeId} onChange={onSelect} kind="navigation" variant="underline" ariaLabel={ariaLabel} className={className} />;
}
export function AnimatedSegmentedControl<T extends string>({ options, value, onChange, ariaLabel='Pilih mode', className }: { options:Array<{ value:T; label:string; count?:number }>; value:T; onChange:(value:T)=>void; layoutId?:string; ariaLabel?:string; className?:string }) {
  return <ChoiceStrip items={options.map(option=>({ id:option.value, label:option.label, count:option.count }))} value={value} onChange={onChange} kind="filter" variant="segmented" ariaLabel={ariaLabel} className={className} />;
}
`);
await put('components/ui/field-styles.ts', String.raw`/** Shared appearance for native inputs, selects and custom select triggers. */
export const fieldStyles = 'ui-field-control min-w-0 max-w-full min-h-[44px] w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] leading-[20px] text-[var(--foreground)] transition-colors placeholder:text-[var(--muted-foreground)] hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:border-[var(--primary-ink)] focus-visible:ring-2 focus-visible:ring-[var(--primary-ink)]/20 disabled:cursor-not-allowed disabled:opacity-50';
`);
await put('components/ui/workspace-primitives.tsx', String.raw`'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

/** Messages can be paragraphs or contain long references; never render them
 * as a non-shrinking status badge. Local wrapping, not body overflow clipping.
 */
export function InlineNotice({ children, tone='info', onDismiss, className }: { children:React.ReactNode; tone?:'success'|'info'|'warning'|'danger'; onDismiss?:()=>void; className?:string }) {
  if (!children) return null;
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'danger' || tone === 'warning' ? AlertCircle : Info;
  return <div role={tone === 'danger' ? 'alert' : 'status'} data-ui="notice" data-tone={tone} className={cn('ui-notice', className)}>
    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><div className="ui-notice-text">{children}</div>
    {onDismiss && <Button size="icon" variant="ghost" aria-label="Tutup pemberitahuan" onClick={onDismiss}><X className="h-4 w-4" /></Button>}
  </div>;
}
export function Surface({ as:Tag='section', variant='ruled', className, ...props }: React.HTMLAttributes<HTMLElement> & { as?:'section'|'div'|'article'; variant?:'plain'|'ruled'|'panel' }) {
  return <Tag {...props} data-ui="surface" data-variant={variant} className={cn('ui-surface', className)} />;
}
export type StatItem = { id:string; label:string; value:React.ReactNode; onSelect?:()=>void; icon?:React.ComponentType<{ className?:string }> };
export function StatStrip({ items, label='Ringkasan operasional' }: { items:StatItem[]; label?:string }) {
  return <div className="stat-strip" data-ui="stat-strip" aria-label={label} style={{ '--stat-count':Math.min(items.length,4) } as React.CSSProperties}>
    {items.map(item=>{ const Icon=item.icon; const body=<><span className="stat-label">{item.label}{Icon && <Icon className="h-4 w-4 shrink-0" />}</span><span className="stat-value">{item.value}</span></>;
      return item.onSelect ? <button key={item.id} type="button" onClick={item.onSelect} className="stat-item">{body}</button> : <div key={item.id} className="stat-item">{body}</div>;
    })}
  </div>;
}
`);
await put('components/ui/workspace.css', String.raw`/* Shared component rules. Density is separate from brand color and shape. */
.choice-strip{display:flex;align-items:center;gap:4px;min-width:0;max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none;position:relative;border-bottom:1px solid var(--border)}
.choice-strip::-webkit-scrollbar{display:none}
.choice-item{display:inline-flex;align-items:center;justify-content:center;gap:6px;flex:0 0 auto;min-height:44px;padding:8px 12px;border:0;border-bottom:2px solid transparent;background:transparent;font:inherit;font-size:14px;line-height:20px;color:var(--muted-foreground);white-space:nowrap}
.choice-item[data-active]{border-bottom-color:var(--primary);color:var(--primary-ink);font-weight:600}
.choice-item:hover{background:var(--accent-surface)}
.choice-item:focus-visible{outline:2px solid var(--primary-ink);outline-offset:-3px}
.choice-count{font-size:12px;font-variant-numeric:tabular-nums}
.choice-strip[data-variant=segmented]{width:fit-content;border:1px solid var(--border);border-radius:var(--radius-control);padding:2px;gap:2px;background:var(--surface-muted)}
.choice-strip[data-variant=segmented] .choice-item{border:0;border-radius:max(0px,calc(var(--radius-control) - 2px));min-height:40px;padding:6px 10px}
.choice-strip[data-variant=segmented] .choice-item[data-active]{background:var(--surface);color:var(--foreground)}
.filter-toggle[data-active]{color:var(--primary-ink);background:var(--accent-surface)}
.ui-notice{display:flex;align-items:flex-start;gap:8px;min-width:0;max-width:100%;padding:10px 12px;border-left:3px solid currentColor;background:var(--status-info-bg);color:var(--status-info-fg);font-size:14px;line-height:20px}
.ui-notice>svg{margin-top:2px}
.ui-notice-text{flex:1;min-width:0;white-space:normal;overflow-wrap:anywhere}
.ui-notice[data-tone=success]{background:var(--status-success-bg);color:var(--status-success-fg)}
.ui-notice[data-tone=warning]{background:var(--status-warning-bg);color:var(--status-warning-fg)}
.ui-notice[data-tone=danger]{background:var(--status-danger-bg);color:var(--status-danger-fg)}
.ui-surface{min-width:0;max-width:100%}
.ui-surface[data-variant=ruled]{padding:12px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.ui-surface[data-variant=panel]{padding:var(--card-padding);border:var(--border-width) solid var(--border);border-radius:var(--radius-panel);background:var(--surface)}
.stat-strip{display:grid;grid-template-columns:repeat(var(--stat-count),minmax(0,1fr));min-width:0;border-block:1px solid var(--border)}
.stat-item{display:flex;flex-direction:column;justify-content:center;gap:6px;min-width:0;min-height:78px;padding:12px 16px;text-align:left;background:transparent;border:0;border-right:1px solid var(--border)}
.stat-item:last-child{border-right:0}
button.stat-item:hover{background:var(--accent-surface)}
.stat-label{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;line-height:18px;color:var(--muted-foreground)}
.stat-value{font-family:var(--font-heading);font-size:24px;line-height:28px;font-weight:600;font-variant-numeric:tabular-nums}
.cafe-staff{--control-height:44px;--card-padding:14px;--section-gap:16px;min-width:0}
.staff-header{position:sticky;top:0;z-index:30;border-bottom:1px solid var(--border);background:var(--surface)}
.staff-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px 12px;padding:8px 16px;min-width:0}
.staff-identity{display:flex;align-items:center;gap:8px;min-width:0}
.staff-identity>div{min-width:0}
.staff-identity p{overflow-wrap:anywhere}
.staff-account{grid-column:1/-1;grid-row:2;min-width:0;width:100%}
.staff-actions{display:flex;align-items:center;gap:4px;grid-column:2;grid-row:1}
.staff-mobile-nav{padding-inline:4px;min-width:0}
.staff-main{min-width:0;padding:16px;display:flex;flex-direction:column;gap:16px}
.staff-main>div{min-width:0}
.staff-main .workspace-stack{display:flex;flex-direction:column;gap:16px;min-width:0}
.staff-main .workspace-stack>*{min-width:0}
.staff-feedback{min-width:0;max-width:100%;display:grid;gap:8px}
.staff-sidebar{display:none}
.staff-main .visit-list{display:grid;gap:0}
.staff-main .visit-row{border:0;border-bottom:1px solid var(--border);border-radius:0;background:transparent;padding:12px 0;box-shadow:none;min-width:0}
#staff-content{scroll-margin-top:132px}
@media(min-width:768px){
 .staff-toolbar{grid-template-columns:minmax(0,1fr) 280px auto;padding:8px 20px}
 .staff-account{grid-column:2;grid-row:1;width:280px}
 .staff-actions{grid-column:3;grid-row:1}
 .staff-main{padding:20px}
 #staff-content{scroll-margin-top:112px}
}
@media(min-width:1280px){
 .cafe-staff:has(>aside){display:grid;grid-template-columns:216px minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);align-items:start}
 .staff-sidebar{display:flex;position:sticky;top:0;grid-column:1;grid-row:1/span 2;align-self:start;width:auto;height:100vh;height:100dvh;overflow-y:auto;overscroll-behavior:contain;z-index:35;flex-direction:column;border-right:1px solid var(--border);background:var(--surface);padding:12px}
 .staff-header{grid-column:2;grid-row:1;min-width:0}
 .staff-main{grid-column:2;grid-row:2}
 .staff-mobile-nav{display:none}
 #staff-content{scroll-margin-top:80px}
}
@media(max-width:639px){
 .stat-strip{grid-template-columns:repeat(min(var(--stat-count),2),minmax(0,1fr))}
 .stat-item{min-height:64px;padding:8px 12px}
 .stat-item:nth-child(2n){border-right:0}
 .stat-item:nth-child(n+3){border-top:1px solid var(--border)}
 .stat-value{font-size:22px;line-height:26px}
 .ui-field-control{font-size:16px}
 .cafe-staff .ui-button{min-height:44px}
}
@media print{.staff-sidebar,.staff-header{display:none!important}.cafe-staff:has(>aside){display:block}.staff-main{padding:0}}
`);

let t=await read('app/globals.css');
t=once(t,'@import "tw-animate-css";','@import "tw-animate-css";\n@import "../components/ui/workspace.css";','shared css');
t=t.replace('  --radius-control: 12px;', '  --radius-control: 8px;').replace('  --radius-panel: 20px;', '  --radius-panel: 12px;').replace('  --card-padding: 18px;', '  --card-padding: 12px;').replace('  --section-gap: 28px;', '  --section-gap: 16px;').replace('  --control-height: 48px;', '  --control-height: 44px;');
t=t.replace('--card-padding:16px; --section-gap:24px;', '--card-padding:12px; --section-gap:16px;').replace('--card-padding:16px; --section-gap:32px;', '--card-padding:12px; --section-gap:20px;').replace('--radius-control:18px; --radius-panel:26px;', '--radius-control:10px; --radius-panel:16px;').replace('--card-padding:18px; --section-gap:24px;', '--card-padding:14px; --section-gap:18px;').replace('--card-padding:24px; --section-gap:40px;', '--card-padding:16px; --section-gap:24px;').replace(':root[data-theme="airy"] .cafe-staff main { padding-top:36px; }','');
const oldShell=t.indexOf('/* The staff shell may follow demo controls.'); assert.ok(oldShell>0); t=t.slice(0,oldShell);
t+='\n.connection-notice{min-width:0;align-items:flex-start;overflow-wrap:anywhere}.connection-notice>span{min-width:0;flex:1;white-space:normal}.connection-notice>button{flex-shrink:0}\n';
await put('app/globals.css',t);

for(const path of ['components/ui/input.tsx','components/ui/select.tsx']){
 t=await read(path); t=once(t,"import { cn } from '@/lib/utils';", "import { cn } from '@/lib/utils';\nimport { fieldStyles } from './field-styles';",path);
 if(path.endsWith('input.tsx')) t=t.replace(/'flex min-h-\[42px\] w-full rounded-\[var\(--radius-control\)\][^'\n]+'/,'fieldStyles');
 else {
  t=t.replace(/'flex min-h-\[42px\] w-full items-center[^'\n]+'/ , "fieldStyles, 'flex items-center justify-between gap-2 [&>span]:truncate'");
  t=t.replace("'relative flex items-center w-full'", "'ui-field relative flex items-center w-full min-w-0 max-w-full'");
  t=t.replace(/'flex min-h-\[42px\] w-full appearance-none[^'\n]+'/, "fieldStyles, 'appearance-none pr-9 cursor-pointer'");
 }
 await put(path,t);
}
t=await read('components/ui/button.tsx');
t=t.replace("'inline-flex items-center", "'ui-button min-w-0 max-w-full inline-flex items-center").replace('whitespace-nowrap shrink-0 select-none','whitespace-normal text-center break-words select-none [&>svg]:shrink-0').replace("default: 'min-h-[42px]", "default: 'min-h-[44px]").replace("icon: 'min-h-[42px] min-w-[42px]", "icon: 'min-h-[44px] min-w-[44px]");
await put('components/ui/button.tsx',t);

t=await read('components/cafe/ui-primitives.tsx');
t=once(t,"import { cn } from '@/lib/utils';", "import { cn } from '@/lib/utils';\nimport { InlineNotice } from '@/components/ui/workspace-primitives';\nexport { InlineNotice, Surface, StatStrip } from '@/components/ui/workspace-primitives';\nexport { ChoiceStrip, FilterToggle } from '@/components/ui/choice-strip';",'primitive exports');
t=t.replace('inline-flex items-center gap-1.5 text-[12px] leading-[16px] font-medium whitespace-nowrap shrink-0', 'inline-flex max-w-full min-w-0 items-start gap-1.5 text-[12px] leading-[16px] font-medium whitespace-normal [overflow-wrap:anywhere]');
t=t.replace(/export function InlineError\([\s\S]*?\n}\n/, `export function InlineError({ message, className }: { message?:string|null; className?:string }) {\n  return message ? <InlineNotice tone="danger" className={className}>{message}</InlineNotice> : null;\n}\n`);
t=t.replace('min-h-[38px] min-w-[38px]', 'min-h-[44px] min-w-[44px]').replace('min-h-[38px] min-w-[38px]', 'min-h-[44px] min-w-[44px]');
t=t.replace('flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b', 'min-w-0 flex flex-wrap items-center justify-between gap-3 pb-3 border-b');
t=t.replaceAll('flex items-center gap-2 shrink-0">{actions}', 'min-w-0 flex flex-wrap items-center gap-2">{actions}');
await put('components/cafe/ui-primitives.tsx',t);

t=await read('components/cafe/staff-app.tsx');
t=once(t,'  Button,\n', '  Button,\n  PageHeader,\n  InlineNotice,\n  StatStrip,\n  Surface,\n','staff imports');
t=once(t,'className="hidden xl:flex fixed inset-y-0 left-0 z-40 w-[232px] flex-col border-r border-[var(--border)] bg-[var(--surface)] p-5"','className="staff-sidebar"','sidebar');
t=between(t,'      <header className="sticky top-0 z-30 xl:ml-[232px]', '      <a href="#staff-content"', String.raw`      <header className="staff-header">
        <div className="staff-toolbar">
          <div className="staff-identity">
            {onBackToCustomer && <Button variant="ghost" size="icon" onClick={onBackToCustomer} aria-label="Kembali ke menu pelanggan" className="xl:hidden"><ArrowLeft className="h-4 w-4" /></Button>}
            <div><p className="text-sm font-semibold">{cafeConfig.brand.name}</p><p id="active-staff-role" className="text-xs text-[var(--muted-foreground)]">{STAFF_CREDENTIALS[activeStaff]?.roleLabel || currentStaffObj.role}</p></div>
          </div>
          <SelectField aria-label="Petugas aktif" aria-describedby="active-staff-role" value={activeStaff} onChange={(e) => handleSwitchStaff(e.target.value)} wrapperClassName="staff-account">
            {staffList.map((s: any) => <option key={s.id} value={s.id}>{s.userName}</option>)}
          </SelectField>
          <div className="staff-actions">
            <Button variant="ghost" size="icon" title={lastUpdated} disabled={busy || !onRefresh} onClick={onRefresh} aria-label="Perbarui data operasional"><RefreshCw className={busy ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /></Button>
            <Button variant="ghost" size="icon" onClick={() => setIsAuthenticated(false)} aria-label="Keluar dari portal staf"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="staff-mobile-nav"><AnimatedUnderlineTabs items={navItems} activeId={activeSection} onSelect={(id) => { setActiveSection(id); setActionNotice(''); setActionError(''); }} ariaLabel="Navigasi operasional kafe" layoutId="staff-pos-nav-underline" className="border-b-0" /></div>
      </header>
`);
t=once(t,'className="xl:ml-[232px] px-4 sm:px-7 xl:px-10 py-7 space-y-6"','className="staff-main"','main');
t=between(t,'        <div className="flex flex-wrap items-end justify-between gap-4">','        <AnimatePresence>',String.raw`        <PageHeader title={navItems.find(item => item.id === activeSection)?.label || 'Operasional'} actions={canCashier && activeSection === 'kasir' ? <Button variant="primary" onClick={() => setNewOrderModalOpen(true)}><Plus className="h-4 w-4" />Pesanan baru</Button> : undefined} />
`);
t=t.replace('<StatusLabel label={actionNotice} tone="success" />','<InlineNotice tone="success">{actionNotice}</InlineNotice>');
t=t.replace('className="flex items-center justify-between gap-3"\n            >\n              {actionNotice','className="staff-feedback"\n            >\n              {actionNotice');
t=t.replace('className="space-y-6"\n          >\n            <div className="staff-metrics', 'className="workspace-stack"\n          >\n            <div className="staff-metrics');
t=between(t,'            <div className="staff-metrics','            {canCashier && <ShiftControls', String.raw`            <StatStrip items={[
              { id:'new', label:'Pesanan baru', value:pendingOrderRequests.length, icon:Receipt, onSelect:()=>document.getElementById('incoming-orders')?.scrollIntoView({ behavior:'smooth', block:'center' }) },
              ...(canTables ? [{ id:'tables', label:'Meja terisi', value:(snapshot?.tables || []).filter((t:any)=>t.physicalState==='OCCUPIED').length, icon:LayoutGrid, onSelect:()=>{setActiveSection('meja');setFloorSubTab('DENAH');} }] : []),
              ...(canKitchen ? [{ id:'preparing', label:'Dalam proses', value:(snapshot?.orderUnits || []).filter((u:any)=>['QUEUED','PREPARING'].includes(u.fulfillmentStatus)).length, icon:ChefHat, onSelect:()=>{setActiveSection('dapur');setKitchenStatusFilter('ACTIVE');} }] : []),
              ...(canTables ? [{ id:'help', label:'Panggilan tamu', value:openHelpCount, icon:Bell, onSelect:()=>{setActiveSection('meja');setFloorSubTab('ANTREAN');} }] : []),
            ]} />

`);
t=t.replace('<section id="incoming-orders" className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 scroll-mt-28">','<Surface id="incoming-orders" variant="ruled" className="space-y-3 scroll-mt-28">');
t=t.replace('              </section>\n            )}\n\n            <DemoPaymentControls','              </Surface>\n            )}\n\n            <DemoPaymentControls');
t=t.replace('grid grid-cols-1 lg:grid-cols-12 gap-8 items-start', 'grid grid-cols-1 lg:grid-cols-12 gap-4 items-start');
t=t.replace('className="space-y-1 min-w-[240px] flex-1"','className="space-y-1 min-w-0 basis-[240px] flex-1"');
t=t.replace('className="flex items-center gap-3 shrink-0"','className="flex flex-wrap items-center gap-3 min-w-0"');
await put('components/cafe/staff-app.tsx',t);

t=await read('components/cafe/customer-app.tsx');
t=once(t,'  Button,\n', '  Button,\n  PageHeader,\n  ChoiceStrip,\n  FilterToggle,\n','customer imports');
t=t.replace(/  const heroImageSource =[^\n]+\n/,'');
t=between(t,'              <section className={styles.hero}>','              {snapshot?.outlet?.availabilityNote', '              <PageHeader title="Menu" className="border-b-0 pb-0" />\n');
t=between(t,'                <div className={styles.categories}', '              </div>\n              <div className="flex flex-wrap', String.raw`                <ChoiceStrip items={categoriesWithCounts.map((category:any)=>({ id:category.id, label:category.id==='ALL'?'Semua':category.name }))} value={activeCategoryId} onChange={setActiveCategoryId} ariaLabel="Kategori menu" variant="underline" />
`);
t=once(t,'className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl border border-[var(--border)] bg-white text-left"','className="w-full min-h-[44px] flex items-center justify-between gap-3 py-2 border-b border-[var(--border)] text-left"','customer order status');
t=t.replace('className="rounded-full bg-[var(--accent-surface)] p-2.5"','className="text-[var(--primary-ink)]"');
const filterStart='                <div className="flex items-center gap-2"><button type="button" aria-pressed={onlyFavorites}';
t=between(t,filterStart,'              </div>\n              {filteredCatalog.length', String.raw`                <div className="flex flex-wrap items-center gap-1"><FilterToggle pressed={onlyFavorites} onPressedChange={setOnlyFavorites} className="sm:hidden">Favorit</FilterToggle><FilterToggle pressed={onlyAvailable} onPressedChange={setOnlyAvailable}>Tersedia saja</FilterToggle></div>
`);
t=t.replace('max-w-[1080px] mx-auto px-4 sm:px-6 pt-5 pb-44','max-w-[1080px] mx-auto px-4 sm:px-6 pt-3 pb-28 min-w-0');
t=t.replace('max-w-[1080px] mx-auto px-4 py-3 flex','max-w-[1080px] mx-auto px-4 py-2 flex');
t=t.replace('className="space-y-4"\n            >\n              <PageHeader title="Menu"','className="space-y-3"\n            >\n              <PageHeader title="Menu"');
t=t.replace('justify-between gap-2 mt-auto pt-4', 'justify-between gap-2 mt-auto pt-2');
t=t.replace('<button type="button" aria-label={`Tambah ${item.name}`} disabled={!item.isAvailable || busy} onClick={() => handleQuickAddOrConfigure(item)} className={styles.addButton}><Plus className="w-4 h-4" /><span className="hidden sm:inline">Tambah</span></button>', '<Button variant="subtle" size="sm" aria-label={`Tambah ${item.name}`} disabled={!item.isAvailable || busy} onClick={() => handleQuickAddOrConfigure(item)} className="min-h-[44px] min-w-[44px]"><Plus className="w-4 h-4" /><span className="hidden sm:inline">Tambah</span></Button>');
await put('components/cafe/customer-app.tsx',t);
await put('components/cafe/customer-app.module.css', String.raw`.customer{--customer-max:1080px;min-width:0}
.menuToolbar{min-width:0;display:grid;gap:6px}
.menuGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px 16px}
.menuCard{min-width:0;display:flex;flex-direction:column;background:transparent}
.menuImage{aspect-ratio:1.4;position:relative;background:var(--surface-muted);overflow:hidden;border-radius:var(--radius-image)}
.menuImage img{width:100%;height:100%;object-fit:cover}
.menuCardBody{padding:10px 0 0;display:flex;flex:1;flex-direction:column;min-width:0}
.menuDescription{font-size:13px;line-height:1.45;color:var(--muted-foreground);margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.favorite{position:absolute;right:4px;top:4px;width:44px;height:44px;display:flex;justify-content:center;align-items:center;border-radius:var(--radius-control);background:#fffffff5}
.soldOut .menuImage img{filter:grayscale(1);opacity:.65}
.soldOutBadge,.quantityBadge{position:absolute;left:8px;bottom:8px;border-radius:4px;padding:3px 6px;font-size:12px;font-weight:600;background:#fffffff0}
.quantityBadge{background:var(--foreground);color:white}
.bottomNav{position:fixed;bottom:0;left:0;right:0;min-height:64px;padding-bottom:env(safe-area-inset-bottom,0px);display:flex;justify-content:center;background:var(--surface);border-top:1px solid var(--border);z-index:30}
.bottomNav button{width:140px;min-width:0;min-height:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:var(--muted-foreground);font-size:12px;font-weight:500;position:relative}
.bottomNav .navActive{color:var(--primary-ink)}
.bottomNav .navActive:before{content:'';position:absolute;top:0;height:2px;width:24px;background:var(--primary)}
:global([data-theme="editorial"]) .menuGrid{grid-template-columns:1fr;gap:0}
:global([data-theme="editorial"]) .menuCard{flex-direction:row;border-bottom:1px solid var(--border-strong);padding:12px 0}
:global([data-theme="editorial"]) .menuImage{width:116px;min-width:116px;aspect-ratio:1;align-self:flex-start}
:global([data-theme="editorial"]) .menuCardBody{padding:0 0 0 14px}
:global([data-theme="editorial"]) .menuDescription{-webkit-line-clamp:2}
:global([data-theme="playful"]) .menuCard{border:var(--border-width) solid var(--foreground);border-radius:var(--radius-panel);overflow:hidden;box-shadow:var(--shadow-panel);background:var(--surface)}
:global([data-theme="playful"]) .menuCardBody{padding:10px}
:global([data-theme="playful"]) .menuImage{border-radius:0}
:global([data-theme="airy"]) .menuGrid{gap:24px 20px}
@media(max-width:700px){.menuGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 12px}.menuImage{aspect-ratio:1.35}.menuDescription{display:none}.bottomNav button{flex:1;font-size:11px}.menuCardBody{padding-top:8px}:global([data-theme="editorial"]) .menuImage{width:88px;min-width:88px}:global([data-theme="editorial"]) .menuDescription{display:-webkit-box}:global([data-theme="airy"]) .menuGrid{gap:20px 16px}}
@media(max-width:359px){.menuGrid{grid-template-columns:1fr}.menuCard{flex-direction:row}.menuImage{width:88px;min-width:88px;aspect-ratio:1;align-self:flex-start}.menuCardBody{padding:0 0 0 10px}}
@media(prefers-reduced-motion:reduce){.menuCard,.menuImage img{transition:none;transform:none!important}}
`);

// Panels are layout primitives, not separate hand-styled card implementations.
t=await read('components/cafe/shift-controls.tsx');
t=t.replace('Money, StatusLabel }','Money, StatusLabel, Surface, InlineNotice }');
t=t.replace('<section className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4" aria-label="Shift kasir">','<Surface variant="ruled" className="space-y-3" aria-label="Shift kasir">');
t=t.replace('  </section>;','  </Surface>;').replace('<p role="status" className="text-sm text-[var(--status-success-fg)]">{notice}</p>', '<InlineNotice tone="success">{notice}</InlineNotice>');
await put('components/cafe/shift-controls.tsx',t);

// The public catalog preset now includes the existing request inbox. A pure
// read-only catalog remains an explicit module selection, without a database.
t=await read('src/config/catalog.mjs');
t=once(t,"catalog: { label: 'Menu only', modules: ['catalog'], paymentMode: 'cashier' }", "catalog: { label: 'Menu + waiter requests', modules: ['catalog', 'ordering'], paymentMode: 'cashier' }",'catalog preset');
await put('src/config/catalog.mjs',t);
t=await read('demos/manifest.ts');
t=once(t,"['catalog', 'Menu catalog', 'A clear, searchable menu guests can open from a table QR.', 'For cafes that take orders directly with staff.'", "['catalog', 'Menu and waiter requests', 'Guests keep their own order list and send it to the waiter. Payment stays offline.', 'For table ordering handled by staff, without a POS or online payment.'",'catalog demo');
await put('demos/manifest.ts',t);
t=await read('demos/workspace.tsx');
t=once(t,'  const base = demoBasePath(demo);','  const base = demoBasePath(demo);\n  const readOnlyCatalog = cafeConfig.modules.length === 1 && isModuleEnabled(\'catalog\');','demo runtime selection');
t=t.replaceAll("demo.id === 'catalog'",'readOnlyCatalog').replaceAll("demo.id !== 'catalog'",'!readOnlyCatalog').replace('}, [demo.id]);','}, [demo.id, readOnlyCatalog]);');
await put('demos/workspace.tsx',t);
t=await read('demos/components/scenario-panel.tsx');
t="import { Button, SelectField, Label } from '../../components/cafe/ui-primitives';\n"+t;
t=t.replace('<label htmlFor="demo-scenario">','<Label htmlFor="demo-scenario">').replace('</label>','</Label>').replace('<select id="demo-scenario"','<SelectField wrapperClassName="min-w-0 flex-1" id="demo-scenario"').replace('</select>','</SelectField>').replace('<button type="button" disabled={busy} onClick={load}>','<Button variant="secondary" disabled={busy} onClick={load}>').replace("'Muat skenario'}</button>","'Muat skenario'}</Button>");
await put('demos/components/scenario-panel.tsx',t);
// Remove showcase overrides of shared fields/buttons, keeping only layout.
t=await read('demos/showcase.css');
t=t.replace(/\.demo-scenario-controls select \{[^}]+\}\n/,'').replace(/\.demo-scenario-controls button \{[^}]+\}\n/,'');
await put('demos/showcase.css',t);

// Add source contracts: prevent regressions back to raw selects and bespoke
// category controls; verify catalog requests use the same capability path.
await put('tests/ui-contracts.test.mjs',String.raw`import test from 'node:test';
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
 async function walk(dir){let files=[];for(const entry of await readdir(new URL('../'+dir,import.meta.url),{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())files.push(...await walk(path));else if(path.endsWith('.tsx'))files.push(path);}return files;}
 for(const file of [...await walk('components'),...await walk('demos')]) if(file!=='components/ui/select.tsx') assert.doesNotMatch(await read(file),/<select(?:\s|>)/,file);
});
`);
const pkg=JSON.parse(await read('package.json'));pkg.scripts['test:ui-contracts']='node --test tests/ui-contracts.test.mjs';pkg.scripts.test+=' && npm run test:ui-contracts';await put('package.json',JSON.stringify(pkg,null,2)+'\n');

await put('docs/compact-ui.md',String.raw`# Compact UI and catalog requests

The catalog preset now enables catalog + ordering. Guests retain a list tied to their own customer context and submit it to the existing staff inbox. Staff accept or decline it, serve it, and confirm an offline external-register receipt with a reference. The catalog has no POS, online-payment adapter or kitchen screen. With kitchen enabled, accepted orders use the existing kitchen pipeline. The old order-at-cashier preset remains a compatibility alias; do not sell these as two different feature tiers.

A strictly read-only, database-free menu is still available with --modules catalog. Selecting the catalog preset now requires the same server/runtime as ordering. No live shared backend or provider is implied by the public browser-local showcase.

## Component ownership

- ChoiceStrip: horizontal navigation and single-choice filters. Underline and segmented are variants, not independent implementations. Existing AnimatedUnderlineTabs/AnimatedSegmentedControl entry points delegate to it.
- FilterToggle: independent yes/no filters, built on Button.
- SelectField: native form selection, including staff, tables, reports and scenario selection. Shared fieldStyles also styles Input and custom SelectTrigger. A button opening a multi-step dialog is not a native select.
- InlineNotice: long feedback and error text; wraps locally and has status/alert semantics. StatusLabel is for short state names.
- StatStrip: compact operational totals with separators, not a card per metric.
- Surface: plain, ruled and panel variants. Use panels for a distinct task such as checkout, not every heading or number.
- PageHeader: one title/action layout for customer and staff views.

Shape comes from theme tokens. Workspace density stays compact without reducing primary touch controls below 44 px. Text wrapping and min-width fixes live on the affected components; the document never hides horizontal overflow to conceal defects.

Keep evidence outside source control. UI tests must include feedback after payment creation, rejected actions, long names, scrolling, keyboard use and both sides of responsive breakpoints, not only the initial screen.
`);

// Keep these one-off authoring helpers out of the final source tree.
await rm('scripts/apply-compact-ui.mjs');
await rm('.github/workflows/ui-apply.yml',{force:true});
await rm('.github/workflows/ui-workspace.yml',{force:true});
console.log('Compact UI source changes prepared.');
