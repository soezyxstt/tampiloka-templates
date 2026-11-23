"use client";

import { useLayoutEffect, useRef, useState } from 'react';
import { Button, Dialog } from './index';
import { DemoActionTour, type DemoActionStep } from './demo-action-tour';

export type DemoTourText = readonly [id: string, en: string];
export type DemoTourStep = readonly [title: DemoTourText, instruction: DemoTourText, target: string, ...fallbacks: string[]];

interface DemoTourIdentity {
  /** Change when the visitor switches to a different role or feature mode. */
  id: string;
  language: 'id' | 'en';
  invitationKey?: string;
  role: DemoTourText;
}

export type DemoTourContent = DemoTourIdentity & (
  | { steps: readonly [DemoTourStep, ...DemoTourStep[]]; actionSteps?: never; resume?: never }
  | { actionSteps: readonly [DemoActionStep, ...DemoActionStep[]]; steps?: never; resume?: boolean }
);

const answeredInvitations = new Set<string>();

export function DemoTour(props: DemoTourContent) {
  const [open, setOpen] = useState(Boolean(props.resume));
  const trigger = useRef<HTMLButtonElement>(null);
  const { language, role } = props;
  const label = language === 'en' ? 'Demo guide' : 'Panduan demo';
  const [invited, setInvited] = useState(false);
  const key = props.invitationKey;
  useLayoutEffect(() => {
    if (!key || props.resume || answeredInvitations.has(key)) return;
    try { if (localStorage.getItem(key)) return; } catch { /* Storage may be unavailable. */ }
    setInvited(true);
  }, [key, props.resume]);
  function answer(start: boolean) {
    if (key) {
      answeredInvitations.add(key);
      try { localStorage.setItem(key, '1'); } catch { /* Remember for this visit. */ }
    }
    setInvited(false);
    setOpen(start);
    if (!start) trigger.current?.focus({ preventScroll: true });
  }
  const en = language === 'en';
  return <>
    <button ref={trigger} type="button" className="tl-demo-action-label tl-demo-tour-trigger"
      aria-label={label} aria-haspopup={props.steps ? 'dialog' : undefined} aria-expanded={open} title={label}
      onClick={event => { event.currentTarget.focus(); setOpen(value => !value); }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 7a5 5 0 0 0-5-5H3v16h4a5 5 0 0 1 5 4m0-15a5 5 0 0 1 5-5h4v16h-4a5 5 0 0 0-5 4m0-15v15" />
      </svg>
      <span>{language === 'en' ? 'Guide' : 'Panduan'}</span>
    </button>
    {invited && <Dialog open onOpenChange={() => answer(false)} className="tl-demo-tour"
      title={en ? 'Would you like a hand?' : 'Mau dipandu mencoba demo ini?'}
      closeLabel={en ? 'Close' : 'Tutup'}
      footer={<>
        <Button variant="ghost" onClick={() => answer(false)}>{en ? 'Explore on my own' : 'Lewati, saya coba sendiri'}</Button>
        <Button onClick={() => answer(true)}>{en ? 'Start guide' : 'Mulai panduan'}</Button>
      </>}>
      <p>{en ? 'Follow the highlighted area, one step at a time. You can open the guide again from the toolbar.' : 'Ikuti bagian yang disorot, satu langkah setiap kali. Panduan bisa dibuka kembali lewat tombol Panduan di bagian atas.'}</p>
    </Dialog>}
    {props.actionSteps
      ? open && <DemoActionTour language={language} role={role} steps={props.actionSteps} trigger={trigger} onClose={() => setOpen(false)} />
      : <DemoOverviewTour language={language} role={role} steps={props.steps} open={open} onOpenChange={setOpen} trigger={trigger} />}
  </>;
}

function DemoOverviewTour({ language, role, steps, open, onOpenChange, trigger }: {
  language: DemoTourIdentity['language'];
  role: DemoTourText;
  steps: readonly [DemoTourStep, ...DemoTourStep[]];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.RefObject<HTMLButtonElement | null>;
}) {
  const [index, setIndex] = useState(0);
  const nextButton = useRef<HTMLButtonElement>(null);
  const [spotlight, setSpotlight] = useState<{ top: number; left: number; width: number; height: number; panelAbove: boolean; panelSpace: number }>();
  const english = language === 'en';
  const translate = ([id, en]: DemoTourText) => english ? en : id;
  const label = english ? 'Demo guide' : 'Panduan demo';
  const [title, instruction, ...targets] = steps[index];
  const selectors = targets.join('\n');
  const last = index === steps.length - 1;

  useLayoutEffect(() => {
    if (!open) return;
    const candidates = selectors.split('\n');
    const findTarget = () => {
      for (const selector of candidates) {
        for (const element of document.querySelectorAll<HTMLElement>(selector)) {
          const { width, height } = element.getBoundingClientRect();
          if (width > 1 && height > 1 && getComputedStyle(element).visibility === 'visible') return element;
        }
      }
    };
    let target: HTMLElement | null | undefined;
    let frame = 0;
    const observer = new ResizeObserver(() => schedule());
    const measure = () => {
      const next = findTarget();
      if (next !== target) {
        observer.disconnect();
        observer.observe(document.body);
        target = next;
        if (target) {
          observer.observe(target);
          const box = target.getBoundingClientRect();
          const toolbarBottom = trigger.current?.closest('.tl-demo-toolbar')?.getBoundingClientRect().bottom ?? 0;
          if (box.left < 0 || box.right > innerWidth || box.bottom > innerHeight
            || (box.top < toolbarBottom && !target.closest('.tl-demo-toolbar'))) {
            target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
          }
        }
      }
      if (!target) { setSpotlight(undefined); return; }
      const box = target.getBoundingClientRect();
      const top = Math.max(0, box.top - 5);
      const left = Math.max(0, box.left - 5);
      const width = Math.min(innerWidth, box.right + 5) - left;
      const height = Math.min(innerHeight, box.bottom + 5) - top;
      if (width <= 0 || height <= 0) { setSpotlight(undefined); return; }
      const spaceBelow = innerHeight - top - height;
      const panelAbove = top > spaceBelow;
      const panelSpace = Math.max(top, spaceBelow);
      setSpotlight(previous => previous?.top === top && previous.left === left && previous.width === width
        && previous.height === height && previous.panelSpace === panelSpace
        ? previous : { top, left, width, height, panelAbove, panelSpace });
    };
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }
    measure();
    const layout = new MutationObserver(schedule);
    layout.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      layout.disconnect();
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [open, index, selectors, trigger]);

  const close = () => {
    onOpenChange(false);
    setIndex(0);
  };

  return <Dialog
      open={open}
      onOpenChange={close}
      className={spotlight ? `tl-demo-tour tl-demo-tour-${spotlight.panelAbove ? 'above' : 'below'}` : 'tl-demo-tour'}
      style={spotlight ? { maxHeight: `calc(${spotlight.panelSpace}px - 24px)` } : undefined}
      overlay={spotlight && <div
        aria-hidden="true"
        className="tl-demo-tour-spotlight"
        style={{ top: spotlight.top, left: spotlight.left, width: spotlight.width, height: spotlight.height }}
      />}
      title={`${label} · ${translate(role)}`}
      closeLabel={english ? 'Close guide' : 'Tutup panduan'}
      footer={<>
        <Button variant="ghost" onClick={() => close()}>{english ? 'Skip' : 'Lewati'}</Button>
        {index > 0 && <Button variant="outline" onClick={() => {
          if (index === 1) nextButton.current?.focus();
          setIndex(index - 1);
        }}>{english ? 'Back' : 'Kembali'}</Button>}
        <Button ref={nextButton} onClick={() => {
          if (last) close();
          else setIndex(index + 1);
        }}>
          {last ? (english ? 'Finish' : 'Selesai') : (english ? 'Next' : 'Lanjut')}
        </Button>
      </>}
    >
      <div className="tl-demo-tour-step" aria-live="polite" aria-atomic="true">
        {steps.length > 1 && <p className="tl-demo-tour-progress">{english ? `Step ${index + 1} of ${steps.length}` : `Langkah ${index + 1} dari ${steps.length}`}</p>}
        <div className="tl-demo-tour-copy" key={index}>
          <h3>{translate(title)}</h3>
          <p>{translate(instruction)}</p>
        </div>
      </div>
    </Dialog>
}
