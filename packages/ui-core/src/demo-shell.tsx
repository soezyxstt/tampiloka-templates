"use client";

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';

// Original outlined asset from tampiloka/apps/tampiloka/public/brand/logos/dark.
const wordmark = new URL('./tampiloka-wordmark-dark.svg', import.meta.url).href;

export interface DemoView {
  id: string;
  label: string;
  icon?: ReactNode;
  href?: string;
  onSelect?: () => void;
}

export interface DemoToolbarShellProps {
  family: string;
  label: string;
  galleryLabel: string;
  galleryUrl?: string;
  controls: ReactNode;
  views: readonly DemoView[];
  activeView: string;
  viewLabel: string;
  actions?: ReactNode;
  /** Opt-in compact toolbar; settings stay one activation away. */
  collapsibleLabel?: string;
}

/** Shared demo navigation. Product themes affect the preview, not these controls. */
export function DemoToolbarShell({ family, label, galleryLabel, galleryUrl = 'https://tampiloka.site/templates', controls, views, activeView, viewLabel, actions, collapsibleLabel }: DemoToolbarShellProps) {
  const toolbar = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const element = toolbar.current;
    if (!element) return;
    const measure = () => document.documentElement.style.setProperty('--demo-height', `${Math.ceil(element.getBoundingClientRect().height)}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--demo-height'); };
  }, []);

  const brand = <a className="tl-demo-brand" href={galleryUrl} aria-label={galleryLabel}><img src={wordmark} alt="Tampiloka" width={112} height={26} /><span> / {family}</span></a>;
  const settings = <>
    <div className="tl-demo-controls">{controls}</div>
    <nav className="tl-demo-views" aria-label={viewLabel}>
      {views.map(view => view.href
        ? <a key={view.id} href={view.href} className={view.id === activeView ? 'is-selected' : undefined} aria-current={view.id === activeView ? 'page' : undefined}>{view.icon}<span>{view.label}</span></a>
        : <button key={view.id} type="button" className={view.id === activeView ? 'is-selected' : undefined} aria-pressed={view.id === activeView} onClick={view.onSelect}>{view.icon}<span>{view.label}</span></button>)}
    </nav>
    {actions && <div className="tl-demo-actions">{actions}</div>}
  </>;
  if (collapsibleLabel) return <Collapsible.Root asChild>
    <aside ref={toolbar} className="tl-demo-toolbar demo-toolbar tl-demo-collapsible" aria-label={label}>
      <div className="tl-demo-compact-row">{brand}<Collapsible.Trigger className="tl-demo-toggle">
        <span>{collapsibleLabel}</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </Collapsible.Trigger></div>
      <Collapsible.Content className="tl-demo-settings">{settings}</Collapsible.Content>
    </aside>
  </Collapsible.Root>;
  return <aside ref={toolbar} className="tl-demo-toolbar demo-toolbar" aria-label={label}>{brand}{settings}</aside>;
}
