"use client";

/**
 * Adapted from kokonutui AILoadingState (@kokonutui, MIT).
 * Shows live task status lines while the engine works, so users always
 * see that computation is happening. Sequences are poolr SRMA stages.
 */

import { useEffect, useRef, useState } from "react";

const TASK_SEQUENCES = [
  {
    status: "Pooling studies",
    lines: [
      "Loading effect sizes...",
      "Computing per-study weights...",
      "Fitting random-effects model...",
      "Applying Knapp-Hartung adjustment...",
      "Estimating heterogeneity (Q, I², τ²)...",
    ],
  },
  {
    status: "Running sensitivity analyses",
    lines: [
      "Leave-one-out refits...",
      "Cumulative meta-analysis by year...",
      "Fixed vs random comparison...",
      "Influence diagnostics (Baujat)...",
    ],
  },
  {
    status: "Assessing publication bias",
    lines: [
      "Egger & Begg regressions...",
      "Trim-and-fill imputation...",
      "PET / PEESE estimators...",
      "P-curve skew tests...",
      "Fail-safe N (Rosenthal, Orwin)...",
    ],
  },
  {
    status: "Rendering figures",
    lines: [
      "Forest plot layout...",
      "Funnel + contour regions...",
      "Galbraith / L'Abbe / Baujat...",
      "Generating R replication script...",
    ],
  },
];

const LoadingAnimation = ({ progress }: { progress: number }) => (
  <div className="relative h-6 w-6">
    <svg
      aria-label={`Loading progress: ${Math.round(progress)}%`}
      className="h-full w-full"
      fill="none"
      viewBox="0 0 240 240"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Loading Progress Indicator</title>
      <defs>
        <mask id="poolr-progress-mask">
          <rect fill="black" height="240" width="240" />
          <circle
            cx="120"
            cy="120"
            fill="white"
            r="120"
            strokeDasharray={`${(progress / 100) * 754}, 754`}
            transform="rotate(-90 120 120)"
          />
        </mask>
      </defs>
      <style>{`
        @keyframes rotate-cw { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes rotate-ccw { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        .g-spin circle { transform-origin: 120px 120px; }
        .g-spin circle:nth-child(1) { animation: rotate-cw 8s linear infinite; }
        .g-spin circle:nth-child(2) { animation: rotate-ccw 8s linear infinite; }
        .g-spin circle:nth-child(3) { animation: rotate-cw 8s linear infinite; }
        .g-spin circle:nth-child(4) { animation: rotate-ccw 8s linear infinite; }
        .g-spin circle:nth-child(5) { animation: rotate-cw 8s linear infinite; }
        .g-spin circle:nth-child(6) { animation: rotate-ccw 8s linear infinite; }
        .g-spin circle:nth-child(2n) { animation-delay: 0.2s; }
        .g-spin circle:nth-child(3n) { animation-delay: 0.3s; }
      `}</style>
      <g
        className="g-spin"
        mask="url(#poolr-progress-mask)"
        strokeDasharray="18% 40%"
        strokeWidth="16"
      >
        {/* monochrome ramp — poolr palette, no rainbow */}
        <circle cx="120" cy="120" opacity="0.95" r="150" stroke="#e6e7ea" />
        <circle cx="120" cy="120" opacity="0.85" r="130" stroke="#b9bbc2" />
        <circle cx="120" cy="120" opacity="0.75" r="110" stroke="#8b8d96" />
        <circle cx="120" cy="120" opacity="0.65" r="90" stroke="#5c5e66" />
        <circle cx="120" cy="120" opacity="0.55" r="70" stroke="#3a3c43" />
        <circle cx="120" cy="120" opacity="0.45" r="50" stroke="#23262c" />
      </g>
    </svg>
  </div>
);

interface ActivityStateProps {
  /** Optional heading override; defaults to cycling through SRMA stages. */
  className?: string;
}

export default function ActivityState({ className }: ActivityStateProps) {
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [visibleLines, setVisibleLines] = useState<Array<{ text: string; number: number }>>([]);
  const [scrollPosition, setScrollPosition] = useState(0);
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const lineHeight = 28;

  // Only animate while on screen.
  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), {
      rootMargin: "100px",
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const currentSequence = TASK_SEQUENCES[sequenceIndex];
  const totalLines = currentSequence.lines.length;

  useEffect(() => {
    const initialLines = [];
    for (let i = 0; i < Math.min(3, totalLines); i++) {
      initialLines.push({ text: currentSequence.lines[i], number: i + 1 });
    }
    setVisibleLines(initialLines);
    setScrollPosition(0);
  }, [sequenceIndex, currentSequence.lines, totalLines]);

  useEffect(() => {
    if (!isVisible) return;

    const advanceTimer = setInterval(() => {
      const firstVisibleLineIndex = Math.floor(scrollPosition / lineHeight);
      const nextLineIndex = (firstVisibleLineIndex + 3) % totalLines;

      if (nextLineIndex < firstVisibleLineIndex && nextLineIndex !== 0) {
        setSequenceIndex((prevIndex) => (prevIndex + 1) % TASK_SEQUENCES.length);
        return;
      }

      if (nextLineIndex >= visibleLines.length && nextLineIndex < totalLines) {
        setVisibleLines((prevLines) => [
          ...prevLines,
          { text: currentSequence.lines[nextLineIndex], number: nextLineIndex + 1 },
        ]);
      }

      setScrollPosition((prevPosition) => prevPosition + lineHeight);
    }, 2000);

    return () => clearInterval(advanceTimer);
  }, [isVisible, scrollPosition, visibleLines, totalLines, sequenceIndex, currentSequence.lines, lineHeight]);

  useEffect(() => {
    if (codeContainerRef.current) {
      codeContainerRef.current.scrollTop = scrollPosition;
    }
  }, [scrollPosition]);

  return (
    <div className={className} ref={rootRef}>
      <div className="w-auto space-y-4">
        <div className="ml-2 flex items-center space-x-2 font-medium text-[var(--color-text-muted)]">
          <LoadingAnimation progress={(sequenceIndex / TASK_SEQUENCES.length) * 100} />
          <span className="text-sm">{currentSequence.status}...</span>
        </div>

        <div className="relative">
          <div
            className="relative h-[84px] w-full overflow-hidden rounded-lg font-mono text-xs"
            ref={codeContainerRef}
            style={{ scrollBehavior: "smooth" }}
          >
            <div>
              {visibleLines.map((line) => (
                <div className="flex h-[28px] items-center px-2" key={`${line.number}-${line.text}`}>
                  <div className="w-6 select-none pr-3 text-right text-[var(--color-text-muted)]/60">
                    {line.number}
                  </div>
                  <div className="ml-1 flex-1 text-[var(--color-text)]">{line.text}</div>
                </div>
              ))}
            </div>
          </div>
          <div
            className="pointer-events-none absolute inset-0 rounded-lg"
            style={{
              background:
                "linear-gradient(to bottom, var(--color-surface) 0%, color-mix(in srgb, var(--color-surface) 40%, transparent) 30%, transparent 100%)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
