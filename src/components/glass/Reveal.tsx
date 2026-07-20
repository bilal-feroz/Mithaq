"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Entrance choreography wrapper: 8px rise + fade, standard easing.
 * Collapses to a plain fade (near-instant) under prefers-reduced-motion.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const reduced = useReducedMotion();
  const Component = motion[as];
  return (
    <Component
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay, ease: [0.2, 0.8, 0.2, 1] }}
      className={className}
    >
      {children}
    </Component>
  );
}

/** Stagger container for lists (clause results, chips). */
export function RevealList({
  children,
  className,
  stagger = 0.03,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.ul
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: reduced ? 0 : stagger,
            delayChildren: delay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.ul>
  );
}

export function RevealItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.li
      variants={{
        hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 6 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.26, ease: [0.2, 0.8, 0.2, 1] },
        },
      }}
      className={className}
    >
      {children}
    </motion.li>
  );
}
