'use client';

import * as React from 'react';
import { MotionConfig, motion, useIsPresent, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import { cn } from '@/lib/utils';

/** Shared interaction timings. CSS counterparts live in motion.css. */
export const MOTION = {
  enter: 0.22,
  exit: 0.12,
  reveal: 0.28,
  ease: [0.22, 1, 0.36, 1] as const,
};

/** Apply to both the Next.js app and the standalone Pages showcase. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return <MotionConfig reducedMotion="user" transition={{ type: 'tween', duration: reduce ? 0 : MOTION.enter, ease: MOTION.ease }}>{children}</MotionConfig>;
}

/** A keyed screen. Exiting content cannot receive pointer or keyboard actions.
 * Never key this by a snapshot timestamp, polling result or form value.
 */
export const MotionPanel = React.forwardRef<HTMLDivElement, HTMLMotionProps<'div'>>(
  ({ children, className, ...props }, ref) => {
    const reduce = useReducedMotion();
    const present = useIsPresent();
    return <motion.div
      {...props}
      ref={ref}
      data-ui="motion-panel"
      data-motion-present={present ? 'true' : 'false'}
      inert={!present || undefined}
      aria-hidden={!present || undefined}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0, transition: { duration: reduce ? 0 : MOTION.enter, ease: MOTION.ease } }}
      exit={{ opacity: 0, y: reduce ? 0 : -4, transition: { duration: reduce ? 0 : MOTION.exit, ease: MOTION.ease } }}
      className={cn('ui-motion-panel', className)}
    >{children}</motion.div>;
  }
);
MotionPanel.displayName = 'MotionPanel';

/** Reveal intact text, not a separate DOM node for each letter. Screen readers,
 * copying and find-in-page retain the original text. CSS has no hidden base state.
 */
export function RevealText({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span data-ui="reveal-text" className={cn('ui-reveal-text', className)}>{children}</span>;
}

/** Stable item IDs prevent animation from replaying on background refresh. */
export const MotionItem = React.forwardRef<HTMLElement, HTMLMotionProps<'article'> & { order?: number }>(
  ({ children, order = 0, className, ...props }, ref) => {
    const reduce = useReducedMotion();
    const present = useIsPresent();
    return <motion.article
      {...props}
      ref={ref}
      data-ui="motion-item"
      inert={!present || undefined}
      aria-hidden={!present || undefined}
      layout={reduce ? false : 'position'}
      initial={reduce ? false : { opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: reduce ? 0 : MOTION.exit } }}
      transition={{ type: 'tween', duration: reduce ? 0 : MOTION.enter, ease: MOTION.ease, delay: reduce ? 0 : Math.min(order, 5) * 0.016, layout: { delay: 0, duration: reduce ? 0 : MOTION.enter } }}
      className={cn('min-w-0', className)}
    >{children}</motion.article>;
  }
);
MotionItem.displayName = 'MotionItem';
