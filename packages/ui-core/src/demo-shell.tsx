"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@ui-sdk/react/collapsible';
import { DemoTour, type DemoTourContent } from './demo-tour';

export type { DemoActionStep } from './demo-action-tour';
export type { DemoTourContent, DemoTourStep, DemoTourText } from './demo-tour';

const wordmark = new URL('./tampiloka-wordmark-dark.svg', import.meta.url).href;
const COLLAPSE_STORAGE_KEY = 'tampiloka:demo-toolbar-collapsed';

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
  tour?: DemoTourContent;
  /** Opt-in compact toolbar; settings stay one activation away. */
  collapsibleLabel?: string;
}

export function DemoToolbarShell({
  family,
  label,
  galleryLabel,
  galleryUrl = 'https://tampiloka.site/templates',
  controls,
  views,
  activeView,
  viewLabel,
  actions,
  tour,
  collapsibleLabel,
}: DemoToolbarShellProps) {
  const toolbar = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const english = galleryUrl.includes('/en/') || tour?.language === 'en';

  useEffect(() => {
    try {
      if (sessionStorage.getItem(COLLAPSE_STORAGE_KEY) === '1') setCollapsed(true);
    } catch {
      /* Storage may be unavailable. */
    }
  }, []);

  const toggleCollapsed = (next: boolean) => {
    setCollapsed(next);
    try {
      sessionStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* Storage may be unavailable. */
    }
  };

  useLayoutEffect(() => {
    if (collapsed) {
      document.documentElement.style.setProperty('--demo-height', '0px');
      return () => {
        document.documentElement.style.removeProperty('--demo-height');
      };
    }
    const element = toolbar.current;
    if (!element) return;
    const measure = () =>
      document.documentElement.style.setProperty('--demo-height', `${Math.ceil(element.getBoundingClientRect().height)}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--demo-height');
    };
  }, [collapsed]);

  const hideLabel = english ? 'Hide demo bar' : 'Sembunyikan bar demo';
  const showLabel = english ? 'Show demo bar' : 'Tampilkan bar demo';

  if (collapsed) {
    return (
      <div className="tl-demo-collapsed-dock" role="region" aria-label={label}>
        <button
          type="button"
          className="tl-demo-restore-pill"
          onClick={() => toggleCollapsed(false)}
          aria-label={showLabel}
          title={showLabel}
        >
          <span className="tl-demo-restore-dot" aria-hidden="true" />
          <span>Demo</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
    );
  }

  const brand = (
    <a className="tl-demo-brand" href={galleryUrl} aria-label={galleryLabel}>
      <img src={wordmark} alt="Tampiloka" width={112} height={26} />
      <span> / {family}</span>
    </a>
  );

  const collapseButton = (
    <button
      type="button"
      className="tl-demo-collapse-btn"
      onClick={() => toggleCollapsed(true)}
      aria-label={hideLabel}
      title={hideLabel}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m18 15-6-6-6 6" />
      </svg>
    </button>
  );

  const settings = (
    <>
      <div className="tl-demo-controls">{controls}</div>
      <nav className="tl-demo-views" aria-label={viewLabel}>
        {views.map((view) =>
          view.href ? (
            <a
              key={view.id}
              href={view.href}
              className={view.id === activeView ? 'is-selected' : undefined}
              aria-current={view.id === activeView ? 'page' : undefined}
            >
              {view.icon}
              <span>{view.label}</span>
            </a>
          ) : (
            <button
              key={view.id}
              type="button"
              className={view.id === activeView ? 'is-selected' : undefined}
              aria-pressed={view.id === activeView}
              onClick={view.onSelect}
            >
              {view.icon}
              <span>{view.label}</span>
            </button>
          ),
        )}
      </nav>
      <div className="tl-demo-actions">
        {tour && <DemoTour key={tour.id} {...tour} />}
        {actions}
        {collapseButton}
      </div>
    </>
  );

  if (collapsibleLabel) {
    return (
      <Collapsible
        render={<aside ref={toolbar} className="tl-demo-toolbar demo-toolbar tl-demo-collapsible" aria-label={label} />}
      >
        <div className="tl-demo-compact-row">
          {brand}
          <div className="tl-demo-compact-actions">
            <CollapsibleTrigger className="tl-demo-toggle">
              <span>{collapsibleLabel}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </CollapsibleTrigger>
            {collapseButton}
          </div>
        </div>
        <CollapsiblePanel className="tl-demo-settings">{settings}</CollapsiblePanel>
      </Collapsible>
    );
  }

  return (
    <aside ref={toolbar} className="tl-demo-toolbar demo-toolbar" aria-label={label}>
      {brand}
      {settings}
    </aside>
  );
}
