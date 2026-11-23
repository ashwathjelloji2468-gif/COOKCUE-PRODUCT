"use client";

import React from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";

// Modern snappy SaaS easing (cubic-bezier)
export const MOTION_EASE = [0.21, 0.47, 0.32, 0.98] as const;

export interface MotionBaseProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}

export interface FadeInProps extends MotionBaseProps {
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
}

/**
 * FadeIn & SlideIn primitive.
 * Smoothly enters content with optional directional slide.
 * Respects prefers-reduced-motion.
 */
export function FadeIn({
  children,
  className,
  direction = "up",
  distance = 16,
  delay = 0,
  duration = 0.4,
}: FadeInProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  const offset = {
    up: { y: distance, x: 0 },
    down: { y: -distance, x: 0 },
    left: { x: distance, y: 0 },
    right: { x: -distance, y: 0 },
    none: { x: 0, y: 0 },
  }[direction];

  return (
    <motion.div
      initial={{ opacity: 0, x: offset.x, y: offset.y }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{
        duration,
        delay,
        ease: MOTION_EASE,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  initialDelay?: number;
}

/**
 * StaggerChildren container.
 * Coordinates smooth sequential entrances of StaggerItem children.
 */
export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.06,
  initialDelay = 0.04,
}: StaggerContainerProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: initialDelay,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
  yOffset?: number;
  duration?: number;
}

/**
 * Child item inside a StaggerContainer.
 */
export function StaggerItem({
  children,
  className,
  yOffset = 14,
  duration = 0.35,
}: StaggerItemProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: yOffset },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration,
        ease: MOTION_EASE,
      },
    },
  };

  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}

export interface HoverLiftProps {
  children: React.ReactNode;
  className?: string;
  y?: number;
  scale?: number;
}

/**
 * Micro-hover lift wrapper for cards and clickable units.
 * Provides tactile elevation without layout shifts.
 */
export function HoverLift({
  children,
  className,
  y = -3,
  scale = 1.01,
}: HoverLiftProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      whileHover={{
        y,
        scale,
        transition: { duration: 0.18, ease: "easeOut" },
      }}
      whileTap={{
        scale: 0.99,
        y: 0,
        transition: { duration: 0.1 },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export interface PageSectionRevealProps {
  children: React.ReactNode;
  className?: string;
  yOffset?: number;
  delay?: number;
  duration?: number;
}

/**
 * Scroll reveal section wrapper using viewport intersection.
 * Fires once when entering the user's viewport.
 */
export function PageSectionReveal({
  children,
  className,
  yOffset = 20,
  delay = 0,
  duration = 0.5,
}: PageSectionRevealProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration,
        delay,
        ease: MOTION_EASE,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export interface OneShotBadgeProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Subtle one-shot entrance for APPROVED or milestone badges.
 * Never loops infinitely, preventing visual fatigue.
 */
export function OneShotBadge({ children, className }: OneShotBadgeProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <span className={className}>{children}</span>;
  }

  return (
    <motion.span
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: [0.92, 1.05, 1], opacity: 1 }}
      transition={{
        duration: 0.45,
        ease: "easeOut",
        times: [0, 0.6, 1],
      }}
      className={cn("inline-flex items-center", className)}
    >
      {children}
    </motion.span>
  );
}
