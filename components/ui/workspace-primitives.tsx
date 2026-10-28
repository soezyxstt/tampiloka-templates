'use client';

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
