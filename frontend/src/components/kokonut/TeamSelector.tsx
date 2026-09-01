"use client";

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
  const [peopleCount, setPeopleCount] = useState(() => {
    try {
      const saved = localStorage.getItem("poolr.teamSize");
      return saved ? parseInt(saved, 10) || defaultValue : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  const [reviewerNames, setReviewerNames] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("poolr.reviewerNames");
      return saved ? JSON.parse(saved) : members.slice(0, defaultValue).map(m => m.name);
    } catch {
      return members.slice(0, defaultValue).map(m => m.name);
    }
  });
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
    try {
      localStorage.setItem("poolr.teamSize", String(n));
    } catch { /* ignore */ }
    onChange?.(n);
  };

  const updateReviewerName = (index: number, name: string) => {
    setReviewerNames(prev => {
      const next = [...prev];
      next[index] = name;
      try {
        localStorage.setItem("poolr.reviewerNames", JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
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
      <div className="w-full max-w-xs rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm">
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
                    className="size-11 overflow-hidden rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-surface-2)] shadow-sm ring-1 ring-[var(--color-border)]"
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
              className={cn(
                "flex size-9 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]",
                "transition-all duration-150",
                "hover:border-[var(--color-border-strong)] hover:bg-[var(--hover-surface)] hover:text-[var(--color-text)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40 focus-visible:ring-offset-2",
                "active:bg-[var(--color-surface-2)]",
                "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[var(--color-surface)]"
              )}
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
                    className="block select-none font-semibold text-2xl text-[var(--color-text)] tabular-nums"
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
              <span className="text-[11px] text-[var(--color-text-muted)]">
                {peopleCount === 1 ? "reviewer" : "reviewers"}
              </span>
            </div>

            <button
              aria-label="Increase team size"
              className={cn(
                "flex size-9 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]",
                "transition-all duration-150",
                "hover:border-[var(--color-border-strong)] hover:bg-[var(--hover-surface)] hover:text-[var(--color-text)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40 focus-visible:ring-offset-2",
                "active:bg-[var(--color-surface-2)]",
                "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[var(--color-surface)]"
              )}
              disabled={peopleCount >= maxTeamSize}
              onClick={handleIncrement}
              onKeyDown={(e) => handleKeyDown(e, "increment")}
              type="button"
            >
              <Plus aria-hidden="true" className="size-3.5" strokeWidth={2} />
            </button>
          </motion.div>
        </fieldset>

        {/* Reviewer names */}
        <div className="mt-4 space-y-2">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Reviewer Names
          </div>
          {Array.from({ length: peopleCount }).map((_, i) => (
            <input
              key={i}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[12px] text-[var(--color-text)] focus-visible:border-[var(--color-border-strong)] focus-visible:outline-none"
              value={reviewerNames[i] || members[i]?.name || `Reviewer ${i + 1}`}
              onChange={(e) => updateReviewerName(i, e.target.value)}
              placeholder={`Reviewer ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
