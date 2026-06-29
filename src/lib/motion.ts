import type { Variants } from "framer-motion";

/**
 * Shared Framer Motion variants for the Syncrate UI.
 *
 * Tasteful & subtle by design: 120–200ms ease-out entrances, 40ms stagger.
 * Reduced-motion is honored globally via CSS (see globals.css) and by
 * Framer's own `useReducedMotion` where component-level control is needed.
 *
 * Usage:
 *   <motion.div variants={fadeInUp} initial="hidden" animate="visible" />
 *   <motion.ul variants={staggerContainer} initial="hidden" animate="visible">
 *     <motion.li variants={staggerItem} /> ...
 */

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: EASE_OUT },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15, ease: EASE_OUT } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.15, ease: EASE_OUT },
  },
};

/** Parent container that staggers its children's entrances. */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.04, delayChildren: 0.02 },
  },
};

/** Child item used inside a `staggerContainer`. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: EASE_OUT },
  },
};

/** Hover/press microstate for interactive cards. */
export const cardHover = {
  rest: { y: 0 },
  hover: { y: -2, transition: { duration: 0.15, ease: EASE_OUT } },
  tap: { scale: 0.99 },
} satisfies Variants;

/** Dialog/popover content that scales in from center. */
export const popContent: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 4 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.16, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 4,
    transition: { duration: 0.12, ease: "easeIn" },
  },
};

export const motionEase = EASE_OUT;
