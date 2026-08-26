"use client";

/**
 * Adapted from kokonutui TeamSelector (@dorianbaffier, MIT).
 * Ported off next/image + dicebear remote URLs: avatars are poolr's local
 * inline SVG set (same visual family), so the desktop app works offline.
 * In poolr this selects how many reviewers are screening.
 */

import { Minus, Plus } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { useRef, useState } from "react";
import { cn } from "../../lib/utils";

const AVATAR_OVERLAP = 12;

export interface TeamMember {
  id: string;
  name: string;
  svg: React.ReactNode;
}

/* Local avatar set — same geometric-face style as the template's dicebear
   notionists, rendered inline so nothing depends on the network. */
function Face({ bg, fg, mouth = "#000000", seed = 0 }: { bg: string; fg: string; mouth?: string; seed?: number }) {
  const eyeY = 14;
  return (
    <svg aria-hidden="true" fill="none" height="40" viewBox="0 0 36 36" width="40" xmlns="http://www.w3.org/2000/svg">
      <rect fill={bg} height="36" width="36" />
      <rect
        fill={fg}
        height="36"
        rx="6"
        transform={seed % 2 ? "translate(5 -1) rotate(55 18 18) scale(1.1)" : "translate(9 -5) rotate(219 18 18) scale(1)"}
        width="36"
      />
      <g transform={`translate(${seed === 3 ? -3 : 4.5} ${seed === 3 ? 3.5 : -4}) rotate(${seed === 3 ? 7 : 9} 18 18)`}>
        <path d="M15 19c2 1 4 1 6 0" fill="none" stroke={mouth} strokeLinecap="round" />
        <rect fill={mouth} height="2" rx="1" width="1.5" x="10" y={eyeY} />
        <rect fill={mouth} height="2" rx="1" width="1.5" x="24" y={eyeY} />
      </g>
    </svg>
  );
}

export const REVIEWER_MEMBERS: TeamMember[] = [
  { id: "reviewer-1", name: "Reviewer One", svg: <Face bg="#ff005b" fg="#ffb238" seed={0} /> },
  { id: "reviewer-2", name: "Reviewer Two", svg: <Face bg="#ff7d10" fg="#0a0310" mouth="#FFFFFF" seed={1} /> },
  { id: "reviewer-3", name: "Reviewer Three", svg: <Face bg="#0a0310" fg="#ff005b" mouth="#FFFFFF" seed={2} /> },
  { id: "reviewer-4", name: "Reviewer Four", svg: <Face bg="#d8fcb3" fg="#89fcb3" seed={3} /> },
];

const animations = {
  avatar: {
    visible: {
      opacity: 1,
      scale: 1,
      transition: { type: "spring", stiffness: 260, damping: 22, mass: 0.6 },
    },
    hidden: {
      opacity: 0,
      scale: 0.85,
      transition: { duration: 0.18, ease: "easeOut" },
    },
  } satisfies Variants,
  vibration: {
    idle: { x: 0 },
    shake: {
      x: [-3, 3, -2, 2, 0] as const,
      transition: { duration: 0.28, ease: "easeOut" },
    },
  } satisfies Variants,
} as const;

interface TeamSelectorProps {
  members?: TeamMember[];
  defaultValue?: number;
  onChange?: (size: number) => void;
  label?: string;
  className?: string;
}

export default function TeamSelector({
  members = REVIEWER_MEMBERS,
  defaultValue = 1,
  onChange,
  label = "Screening Team",
  className = "",
}: TeamSelectorProps) {
  const maxTeamSize = members.length;
  const [peopleCount, setPeopleCount] = useState(defaultValue);
  const [isVibrating, setIsVibrating] = useState(false);
  const directionRef = useRef<1 | -1>(1);
  const prefersReducedMotion = useReducedMotion();

  const triggerVibration = () => {
    if (prefersReducedMotion) return;
    setIsVibrating(true);
    setTimeout(() => setIsVibrating(false), 280);
  };

  const applyCount = (n: number, dir: 1 | -1) => {
    directionRef.current = dir;
    setPeopleCount(n);
    onChange?.(n);
  };

  const handleIncrement = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (peopleCount < maxTeamSize) applyCount(peopleCount + 1, 1);
    else triggerVibration();
  };

  const handleDecrement = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (peopleCount > 1) applyCount(peopleCount - 1, -1);
    else triggerVibration();
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: "increment" | "decrement") => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (action === "increment") handleIncrement(e);
      else handleDecrement(e);
    }
  };

  const counterDistance = prefersReducedMotion ? 0 : 10;

  return (
    <div className={cn("flex w-full flex-col items-center justify-center", className)}>
      <div className="w-full max-w-xs rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <fieldset>
          <legend className="mb-5 w-full font-medium text-[11px] text-[var(--color-text-muted)] uppercase tracking-[0.14em]">
            {label}
          </legend>

          <div className="mb-7 flex justify-center">
            <div className="flex items-center">
              {members.map((member, index) => (
                <motion.div
                  animate={index < peopleCount ? "visible" : "hidden"}
                  className="flex items-center justify-center"
                  initial={index < defaultValue ? "visible" : "hidden"}
                  key={member.id}
                  style={{
                    marginLeft: index === 0 ? 0 : -AVATAR_OVERLAP,
                    zIndex: maxTeamSize - index,
                  }}
                  variants={animations.avatar}
                >
                  <div
                    title={member.name}
                    className="size-11 overflow-hidden rounded-full border-2 border-white bg-zinc-100 shadow-[0_2px_8px_rgba(0,0,0,0.08)] ring-1 ring-black/5 dark:border-zinc-900 dark:bg-zinc-800 dark:ring-white/5"
                  >
                    {member.svg}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div
            animate={isVibrating ? "shake" : "idle"}
            className="flex items-center justify-center gap-5"
            initial="idle"
            variants={animations.vibration}
          >
            <button
              aria-label="Decrease team size"
              className="flex size-9 items-center justify-center rounded-xl border border-zinc-200/80 bg-white text-zinc-500 transition-all duration-150 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2 active:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white dark:border-white/8 dark:bg-zinc-900 dark:text-zinc-400 dark:active:bg-zinc-800/80 dark:focus-visible:ring-zinc-500/40 dark:focus-visible:ring-offset-zinc-900 dark:hover:border-white/16 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:disabled:hover:bg-zinc-900"
              disabled={peopleCount <= 1}
              onClick={handleDecrement}
              onKeyDown={(e) => handleKeyDown(e, "decrement")}
              type="button"
            >
              <Minus aria-hidden="true" className="size-3.5" strokeWidth={2} />
            </button>

            <div className="flex min-w-16 flex-col items-center">
              <div className="relative h-9 overflow-hidden">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.output
                    animate={{ opacity: 1, y: 0 }}
                    aria-live="polite"
                    className="block select-none font-semibold text-3xl text-zinc-900 tabular-nums dark:text-zinc-100"
                    exit={{
                      opacity: 0,
                      y: directionRef.current * -counterDistance,
                      transition: { duration: 0.14, ease: "easeIn" },
                    }}
                    initial={{ opacity: 0, y: directionRef.current * counterDistance }}
                    key={peopleCount}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    {peopleCount}
                  </motion.output>
                </AnimatePresence>
              </div>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {peopleCount === 1 ? "reviewer" : "reviewers"}
              </span>
            </div>

            <button
              aria-label="Increase team size"
              className="flex size-9 items-center justify-center rounded-xl border border-zinc-200/80 bg-white text-zinc-500 transition-all duration-150 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2 active:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white dark:border-white/8 dark:bg-zinc-900 dark:text-zinc-400 dark:active:bg-zinc-800/80 dark:focus-visible:ring-zinc-500/40 dark:focus-visible:ring-offset-zinc-900 dark:hover:border-white/16 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:disabled:hover:bg-zinc-900"
              disabled={peopleCount >= maxTeamSize}
              onClick={handleIncrement}
              onKeyDown={(e) => handleKeyDown(e, "increment")}
              type="button"
            >
              <Plus aria-hidden="true" className="size-3.5" strokeWidth={2} />
            </button>
          </motion.div>
        </fieldset>
      </div>
    </div>
  );
}
