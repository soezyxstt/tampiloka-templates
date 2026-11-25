"use client";

import type { ReactNode } from 'react';
import { MotionConfig, motion, useReducedMotion } from 'motion/react';

export * from './primitives';
export * from './layout';

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </MotionConfig>
  );
}

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -24px' }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1], delay: reduce ? 0 : Math.min(delay, 0.2) }}
    >
      {children}
    </motion.div>
  );
}
