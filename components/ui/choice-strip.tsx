'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { motion, useReducedMotion } from 'motion/react';
import { MOTION } from './motion';

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
  }, [items, value, variant]);
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
  return <Container ref={root} role={kind === 'filter' ? 'group' : undefined} aria-label={ariaLabel} data-ui="choice-strip" data-motion-indicator={indicator ? "true" : undefined} data-variant={variant} className={cn('choice-strip', className)} onKeyDown={keyboard}>
    {indicator && <motion.span aria-hidden="true" data-ui="choice-indicator" className="choice-indicator" initial={false} animate={indicator} transition={{ type: 'tween', duration: reduce ? 0 : MOTION.enter, ease: MOTION.ease }} />}
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
