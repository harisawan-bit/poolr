"use client";

/**
 * Adapted from kokonutui SmoothDrawer (@dorianbaffier, MIT) — the spring
 * staggered drawer content animation is preserved; shell is vaul via our
 * ui primitives. In poolr: contextual option panels (PRISMA tools, etc.).
 *
 * v0.5.4: replaced zinc-* hardcodes in the icon container with poolr
 * CSS tokens so the drawer respects the active theme.
 */

import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  Button,
} from "../ui";

export const drawerVariants = {
  hidden: {
    y: "100%",
    opacity: 0,
    rotateX: 5,
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },
  visible: {
    y: 0,
    opacity: 1,
    rotateX: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
      mass: 0.8,
      staggerChildren: 0.07,
      delayChildren: 0.2,
    },
  },
} as const;

export const itemVariants = {
  hidden: {
    y: 20,
    opacity: 0,
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 30, mass: 0.8 },
  },
} as const;

interface OptionsDrawerProps {
  trigger: ReactNode;
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  /** Text for the bottom close button; omit to hide the footer. */
  closeText?: string;
}

export default function OptionsDrawer({
  trigger,
  title,
  description,
  icon: Icon,
  children,
  closeText = "Done",
}: OptionsDrawerProps) {
  return (
    <Drawer>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className="mx-auto rounded-t-2xl p-6 shadow-xl">
        <motion.div
          animate="visible"
          className="mx-auto w-full max-w-[460px] space-y-6"
          initial="hidden"
          variants={drawerVariants}
        >
          <motion.div variants={itemVariants}>
            <DrawerHeader className="space-y-2 px-0">
              <DrawerTitle className="flex items-center gap-2.5 font-semibold text-xl tracking-tighter">
                {Icon && (
                  <motion.div variants={itemVariants}>
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1.5 shadow-inner">
                      <Icon className="h-5 w-5 text-[var(--color-text)]" />
                    </div>
                  </motion.div>
                )}
                <motion.span variants={itemVariants}>{title}</motion.span>
              </DrawerTitle>
              {description && (
                <motion.div variants={itemVariants}>
                  <DrawerDescription className="text-sm leading-relaxed tracking-tight">
                    {description}
                  </DrawerDescription>
                </motion.div>
              )}
            </DrawerHeader>
          </motion.div>

          <motion.div variants={itemVariants}>{children}</motion.div>

          {closeText && (
            <motion.div variants={itemVariants}>
              <DrawerFooter className="flex flex-col gap-3 px-0">
                <DrawerClose asChild>
                  <Button
                    className="h-10 w-full rounded-xl font-semibold text-sm tracking-tight"
                    variant="outline"
                  >
                    {closeText}
                  </Button>
                </DrawerClose>
              </DrawerFooter>
            </motion.div>
          )}
        </motion.div>
      </DrawerContent>
    </Drawer>
  );
}
