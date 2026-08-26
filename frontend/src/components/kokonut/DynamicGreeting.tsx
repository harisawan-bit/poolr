"use client";

/**
 * Adapted from kokonutui DynamicText (@dorianbaffier, MIT).
 * Used as the app-open splash while services spin up: cycles "Hello" in
 * many languages, then settles on the last one. Reduced-motion safe.
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

interface Greeting {
  text: string;
  language: string;
}

const greetings: Greeting[] = [
  { text: "Hello", language: "English" },
  { text: "こんにちは", language: "Japanese" },
  { text: "Bonjour", language: "French" },
  { text: "Hola", language: "Spanish" },
  { text: "안녕하세요", language: "Korean" },
  { text: "Ciao", language: "Italian" },
  { text: "Hallo", language: "German" },
  { text: "مرحبا", language: "Arabic" },
];

interface DynamicGreetingProps {
  /** Called once the greeting cycle finishes (splash can hand off). */
  onFinish?: () => void;
}

export default function DynamicGreeting({ onFinish }: DynamicGreetingProps) {
  const reduced = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(!reduced);

  useEffect(() => {
    if (!isAnimating) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = prevIndex + 1;
        if (nextIndex >= greetings.length) {
          clearInterval(interval);
          setIsAnimating(false);
          onFinish?.();
          return prevIndex;
        }
        return nextIndex;
      });
    }, 300);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnimating]);

  // Respect reduced motion: settle immediately on the first greeting.
  useEffect(() => {
    if (reduced) {
      setIsAnimating(false);
      onFinish?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const textVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
    exit: { y: -100, opacity: 0 },
  };

  return (
    <section
      aria-label="poolr is starting up"
      className="flex min-h-[160px] items-center justify-center gap-1 p-4"
    >
      <div className="relative flex h-16 w-60 items-center justify-center overflow-visible">
        {isAnimating ? (
          <AnimatePresence mode="popLayout">
            <motion.div
              animate={textVariants.visible}
              aria-live="off"
              className="absolute flex items-center gap-2 font-medium text-2xl text-[var(--color-text)]"
              exit={textVariants.exit}
              initial={textVariants.hidden}
              key={currentIndex}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div aria-hidden="true" className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
              {greetings[currentIndex].text}
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="flex items-center gap-2 font-medium text-2xl text-[var(--color-text)]">
            <div aria-hidden="true" className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
            {greetings[currentIndex].text}
          </div>
        )}
      </div>
    </section>
  );
}
