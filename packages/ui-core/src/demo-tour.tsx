"use client";

import { useRef, useState } from 'react';
import { Button, Dialog } from './index';

export type DemoTourText = readonly [id: string, en: string];
export type DemoTourStep = readonly [title: DemoTourText, instruction: DemoTourText];

export interface DemoTourContent {
  /** Change when the visitor switches to a different role or feature mode. */
  id: string;
  language: 'id' | 'en';
  role: DemoTourText;
  steps: readonly [DemoTourStep, ...DemoTourStep[]];
}

export function DemoTour({ language, role, steps }: DemoTourContent) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const nextButton = useRef<HTMLButtonElement>(null);
  const english = language === 'en';
  const translate = ([id, en]: DemoTourText) => english ? en : id;
  const label = english ? 'Demo guide' : 'Panduan demo';
  const [title, instruction] = steps[index];
  const last = index === steps.length - 1;

  return <>
    <button
      type="button"
      className="tl-demo-action-label tl-demo-tour-trigger"
      aria-label={label}
      aria-haspopup="dialog"
      title={label}
      onClick={event => {
        event.currentTarget.focus();
        setIndex(0);
        setOpen(true);
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 7a5 5 0 0 0-5-5H3v16h4a5 5 0 0 1 5 4m0-15a5 5 0 0 1 5-5h4v16h-4a5 5 0 0 0-5 4m0-15v15" />
      </svg>
      <span>{english ? 'Guide' : 'Panduan'}</span>
    </button>
    <Dialog
      open={open}
      onOpenChange={setOpen}
      className="tl-demo-tour"
      title={`${label} · ${translate(role)}`}
      closeLabel={english ? 'Close guide' : 'Tutup panduan'}
      footer={<>
        <Button variant="ghost" onClick={() => setOpen(false)}>{english ? 'Skip' : 'Lewati'}</Button>
        {index > 0 && <Button variant="outline" onClick={() => {
          if (index === 1) nextButton.current?.focus();
          setIndex(index - 1);
        }}>{english ? 'Back' : 'Kembali'}</Button>}
        <Button ref={nextButton} onClick={() => {
          if (last) setOpen(false);
          else setIndex(index + 1);
        }}>
          {last ? (english ? 'Finish' : 'Selesai') : (english ? 'Next' : 'Lanjut')}
        </Button>
      </>}
    >
      <div className="tl-demo-tour-step" aria-live="polite" aria-atomic="true">
        {steps.length > 1 && <p className="tl-demo-tour-progress">{english ? `Step ${index + 1} of ${steps.length}` : `Langkah ${index + 1} dari ${steps.length}`}</p>}
        <h3>{translate(title)}</h3>
        <p>{translate(instruction)}</p>
      </div>
    </Dialog>
  </>;
}
