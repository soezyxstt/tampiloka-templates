"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './index';
import type { DemoTourText } from './demo-tour';

export interface DemoActionStep {
  title: DemoTourText;
  instruction: DemoTourText;
  target: string;
  /** Advance after the app confirms this action, rather than on click. */
  result?: string | readonly string[];
  /** A visible state that advances a waiting step. */
  waitFor?: string;
  /** An alternative state that makes the step unnecessary. */
  skipWhen?: string;
  /** Allow skipping this step when its sample data is absent. */
  unavailable?: DemoTourText;
  /** Use the identity of the previous successful action. */
  sameRecord?: boolean;
  link?: { label: DemoTourText; href: string };
  /** Continue with a guide on the destination when this control navigates. */
  onNavigate?: (target: HTMLElement) => void;
}

type Props = {
  language: 'id' | 'en';
  role: DemoTourText;
  steps: readonly [DemoActionStep, ...DemoActionStep[]];
  onClose: () => void;
  trigger: RefObject<HTMLButtonElement | null>;
};

const resultEvent = 'tl:demo-tour-result';

function visible(element: HTMLElement) {
  return element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible';
}

export function DemoActionTour({ language, role, steps, onClose, trigger }: Props) {
  const [index, setIndex] = useState(0);
  const [dialog, setDialog] = useState<HTMLElement | null>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number }>();
  const [available, setAvailable] = useState(false);
  const [canFocus, setCanFocus] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const [complete, setComplete] = useState(false);
  const currentTarget = useRef<HTMLElement | null>(null);
  const record = useRef<string | undefined>(undefined);
  const latest = useRef({ step: steps[0], onClose });
  const step = steps[index];
  latest.current = { step, onClose };
  const en = language === 'en';
  const translate = (copy: DemoTourText) => copy[en ? 1 : 0];

  useLayoutEffect(() => {
    panel.current?.focus({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    let frame = 0;
    let advancing = false;
    let activated: HTMLElement | undefined;
    let activeDialog: HTMLElement | null = null;
    function advance() {
      if (advancing) return;
      advancing = true;
      if (index === steps.length - 1) setComplete(true);
      else setIndex(index + 1);
    }
    function matches(selector: string, root: ParentNode = document) {
      return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(visible);
    }
    function refresh() {
      const current = latest.current.step;
      activeDialog = matches('[role="dialog"][data-state="open"]:not([aria-hidden="true"])').at(-1) ?? null;
      setDialog(activeDialog);
      if (complete) return;
      const root = activeDialog ?? document;
      if ((current.skipWhen && matches(current.skipWhen, root).length)
        || (current.waitFor && matches(current.waitFor, root).length)) {
        advance();
        return;
      }
      const candidates = matches(current.target, root).filter(element => !current.sameRecord || !record.current || element.dataset.demoTourKey === record.current);
      setAvailable(candidates.length > 0);
      const enabledTarget = candidates.find(element => !element.matches(':disabled,[aria-disabled="true"]'));
      setCanFocus(Boolean(enabledTarget));
      const target = enabledTarget ?? candidates[0] ?? null;
      if (target !== currentTarget.current) {
        currentTarget.current = target;
        if (target) {
          const rect = target.getBoundingClientRect();
          const toolbarBottom = trigger.current?.closest('.tl-demo-toolbar')?.getBoundingClientRect().bottom ?? 0;
          const viewport = activeDialog?.getBoundingClientRect();
          if (rect.top < (viewport?.top ?? toolbarBottom + 56) || rect.bottom > (viewport?.bottom ?? innerHeight - 72)
            || !target.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2))) {
            target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
          }
        }
      }
      const rect = target?.getBoundingClientRect();
      const top = Math.max(0, (rect?.top ?? 0) - 5);
      const left = Math.max(0, (rect?.left ?? 0) - 5);
      const next = rect && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth
        ? { top, left, width: Math.min(innerWidth, rect.right + 5) - left, height: Math.min(innerHeight, rect.bottom + 5) - top }
        : undefined;
      setBox(previous => previous?.top === next?.top && previous?.left === next?.left
        && previous?.width === next?.width && previous?.height === next?.height ? previous : next);
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(refresh);
    }
    function activate(event: MouseEvent) {
      const current = latest.current.step;
      if (complete || advancing || current.waitFor || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(current.target) : null;
      if (!target || (activeDialog && !activeDialog.contains(target)) || !visible(target)
        || target.matches(':disabled,[aria-disabled="true"]')
        || (current.sameRecord && record.current && target.dataset.demoTourKey !== record.current)) return;
      if (current.onNavigate) { current.onNavigate(target); return; }
      activated = target;
      if (!current.result) advance();
    }
    function result(event: Event) {
      const detail = (event as CustomEvent<{ action: string; record?: string }>).detail;
      const expected = latest.current.step.result;
      if (advancing || !activated || !detail || !(typeof expected === 'string' ? expected === detail.action : expected?.includes(detail.action))
        || (activated.dataset.demoTourKey && activated.dataset.demoTourKey !== detail.record)) return;
      if (detail.record) record.current = detail.record;
      advance();
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.defaultPrevented && !activeDialog
        && !document.querySelector('[role="listbox"][data-state="open"]')) { trigger.current?.focus({ preventScroll: true }); latest.current.onClose(); }
    }
    currentTarget.current = null;
    refresh();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-current', 'aria-hidden', 'class', 'data-active', 'data-demo-fulfillment', 'data-demo-next-status',
        'data-demo-payment-state', 'data-demo-shift-open', 'data-demo-target', 'data-demo-tour-key', 'data-state', 'disabled', 'hidden', 'open', 'style'],
    });
    document.addEventListener('click', activate, true);
    document.addEventListener(resultEvent, result);
    document.addEventListener('keydown', escape);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('click', activate, true);
      document.removeEventListener(resultEvent, result);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [index, steps.length, complete, trigger]);

  const above = !complete && box && box.top > window.innerHeight - box.top - box.height;
  const label = `${en ? 'Demo guide' : 'Panduan demo'} · ${translate(role)}`;
  const dismiss = () => {
    const target = dialog?.querySelector<HTMLElement>('button[aria-label]');
    (target ?? trigger.current)?.focus({ preventScroll: true });
    onClose();
  };
  return <>
    {!complete && box && createPortal(<div aria-hidden="true" className="tl-demo-tour-spotlight tl-demo-action-spotlight" style={box} />, document.body)}
    {createPortal(<section
      className={`tl-demo-tour tl-demo-action-tour ${dialog ? 'tl-demo-action-tour-in-dialog' : above ? 'tl-demo-action-tour-top' : 'tl-demo-action-tour-bottom'}`}
      ref={panel}
      tabIndex={-1}
      aria-label={label}
    >
      <div className="tl-demo-tour-step" aria-live="polite" aria-atomic="true">
        {(complete || steps.length > 1) && <p className="tl-demo-tour-progress">{complete ? label : en ? `Step ${index + 1} of ${steps.length}` : `Langkah ${index + 1} dari ${steps.length}`}</p>}
        <h3>{complete ? (en ? 'Guide complete' : 'Panduan selesai') : translate(step.title)}</h3>
        {!complete && <p>{translate(!available && step.unavailable ? step.unavailable : step.instruction)}</p>}
      </div>
      <div className="tl-demo-action-tour-controls">
        <Button size="sm" variant="ghost" onClick={dismiss}>{complete ? (en ? 'Finish' : 'Selesai') : (en ? 'Skip' : 'Lewati')}</Button>
        {!complete && step.link && <a href={step.link.href} target="_blank" rel="noopener" className="tl-button tl-button-outline tl-button-sm">{translate(step.link.label)}</a>}
        {!complete && !available && step.unavailable && <Button size="sm" variant="outline" onClick={() => {
          record.current = undefined;
          if (index === steps.length - 1) setComplete(true);
          else setIndex(index + 1);
        }}>{en ? 'Skip this step' : 'Lewati langkah ini'}</Button>}
        {!complete && canFocus && !step.waitFor && <Button size="sm" variant="outline" onClick={() => currentTarget.current?.focus()}>{en ? 'Focus action' : 'Fokus tindakan'}</Button>}
      </div>
    </section>, dialog ?? document.body)}
  </>;
}
