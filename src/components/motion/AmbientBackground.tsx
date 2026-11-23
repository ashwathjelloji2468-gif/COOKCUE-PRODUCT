"use client";

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export interface AmbientBackgroundProps {
  variant?: "hero" | "auth" | "surface";
  className?: string;
  showGrid?: boolean;
}

/**
 * Ambient background with subtle CSS grid & micro-floating gradient orbs.
 * GPU-accelerated (transform/opacity only), lightweight, and strictly pointer-events-none.
 * Simplifies to static graceful gradients when prefers-reduced-motion is active.
 */
export function AmbientBackground({
  variant = "hero",
  className,
  showGrid = true,
}: AmbientBackgroundProps) {
  const shouldReduceMotion = useReducedMotion();

  const isAuth = variant === "auth";
  const isSurface = variant === "surface";
  const isHero = variant === "hero";
  const canAnimate = isHero && !shouldReduceMotion;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden select-none -z-10",
        className
      )}
    >
      {/* 1. Subtle geometric background grid */}
      {showGrid && (
        <div
          className="absolute inset-0 opacity-[0.035] dark:opacity-[0.055]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: isAuth ? "24px 24px" : "32px 32px",
          }}
        />
      )}

      {/* 2. Primary Emerald Ambient Orb (Top Left / Center) - Hero only animated */}
      {!canAnimate ? (
        <div
          className={cn(
            "absolute rounded-full blur-3xl",
            isAuth
              ? "top-1/4 left-1/2 -translate-x-1/2 w-[520px] h-[520px] bg-primary/10 dark:bg-emerald-500/10"
              : isSurface
              ? "-top-32 -left-32 w-80 h-80 bg-primary/5 dark:bg-emerald-500/5"
              : "-top-24 -left-24 w-[480px] h-[480px] bg-primary/10 dark:bg-emerald-500/15"
          )}
        />
      ) : (
        <motion.div
          animate={{
            x: [0, 20, 0],
            y: [0, -25, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="-top-24 -left-24 w-[480px] h-[480px] bg-primary/10 dark:bg-emerald-500/15 absolute rounded-full blur-3xl"
        />
      )}

      {/* 3. Secondary Warm Lime / Forest Accent Orb - Hero only animated */}
      {!canAnimate ? (
        <div
          className={cn(
            "absolute rounded-full blur-3xl",
            isAuth
              ? "bottom-10 right-1/4 w-80 h-80 bg-accent-soft/20 dark:bg-emerald-400/5"
              : isSurface
              ? "top-1/2 -right-32 w-72 h-72 bg-primary/5 dark:bg-emerald-500/5"
              : "top-1/3 -right-32 w-[420px] h-[420px] bg-accent-soft/30 dark:bg-emerald-400/10"
          )}
        />
      ) : (
        <motion.div
          animate={{
            x: [0, -25, 0],
            y: [0, 20, 0],
            scale: [1, 1.08, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="top-1/3 -right-32 w-[420px] h-[420px] bg-[#D9EF79]/8 dark:bg-emerald-400/10 absolute rounded-full blur-3xl"
        />
      )}

      {/* 4. Subtle Top Beaming / Radial Vignette */}
      <div
        className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background/80 to-transparent pointer-events-none"
      />
    </div>
  );
}
