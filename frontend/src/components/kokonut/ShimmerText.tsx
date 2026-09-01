"use client";

import { motion } from "motion/react";
import { cn } from "../../lib/utils";

interface Text_01Props {
  text: string;
  className?: string;
}

export default function ShimmerText({ text = "Text Shimmer", className }: Text_01Props) {
  return (
    <div className="flex items-center justify-center p-2">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden px-4 py-1"
        initial={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.5 }}
      >
        <motion.h1
          animate={{ backgroundPosition: ["200% center", "-200% center"] }}
          className={cn(
            "bg-[length:200%_100%] bg-gradient-to-r from-[var(--color-text-muted)] via-[var(--color-text)] to-[var(--color-text-muted)] bg-clip-text font-bold text-3xl text-transparent",
            className
          )}
          transition={{
            duration: 2.5,
            ease: "linear",
            repeat: Number.POSITIVE_INFINITY,
          }}
        >
          {text}
        </motion.h1>
      </motion.div>
    </div>
  );
}
