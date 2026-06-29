"use client";

import { motion } from "framer-motion";
import { fadeInUp, staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/utils/cn";

/**
 * Thin Framer Motion wrappers for consistent entrance animations across the app.
 * `Stagger` is a container that cascades its children; pair with `StaggerItem`.
 * `FadeIn` is a single fade-and-rise on mount.
 */

export function FadeIn({
  children,
  className,
  delay = 0,
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly delay?: number;
}) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      transition={{ delay }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

FadeIn.displayName = "FadeIn";

export function Stagger({
  children,
  className,
  as = "div",
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly as?: "div" | "ul" | "section";
}) {
  const MotionTag = motion[as];
  return (
    <MotionTag
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={cn(className)}
    >
      {children}
    </MotionTag>
  );
}

Stagger.displayName = "Stagger";

export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly as?: "div" | "li";
}) {
  const MotionTag = motion[as];
  return (
    <MotionTag variants={staggerItem} className={cn(className)}>
      {children}
    </MotionTag>
  );
}

StaggerItem.displayName = "StaggerItem";
