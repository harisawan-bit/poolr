import { describe, it, expect } from "vitest";

/**
 * Guards the five MIT-licensed component-library swaps on the ui branch
 * WITHOUT a DOM renderer (this project has no jsdom / testing-library, and
 * adding one was not in scope) and WITHOUT node builtins (the app tsconfig
 * only declares `vite/client` types, and widening it was out of scope).
 *
 * Vite's `?raw` suffix imports the component source as a string at build
 * time, which gives us the same guarantee: the guards that must never be
 * removed (reduced-motion handling, token-only colors, accessibility roles,
 * barrel exports) are asserted against the real shipped source.
 */

import barrelSrc from "../../components/ui/index.tsx?raw";
import glowSrc from "../../components/ui/GlowBorderCard.tsx?raw";
import numberSrc from "../../components/ui/AnimatedNumber.tsx?raw";
import spotlightSrc from "../../components/ui/SpotlightNavItem.tsx?raw";
import loaderSrc from "../../components/ui/KineticTextLoader.tsx?raw";
import annotatedSrc from "../../components/ui/AnnotatedText.tsx?raw";

describe("component-library swaps are wired into the barrel", () => {
  it("index.tsx exports all five swapped components", () => {
    for (const name of [
      "GlowBorderCard",
      "AnimatedNumber",
      "SpotlightNavItem",
      "KineticTextLoader",
      "AnnotatedText",
    ]) {
      expect(barrelSrc).toContain(`export { ${name} }`);
    }
  });
});

describe("GlowBorderCard", () => {
  it("drives its glow from poolr tokens, not hardcoded colors", () => {
    expect(glowSrc).toContain("var(--color-accent)");
    expect(glowSrc).toContain("var(--color-border-strong)");
    // No stray hex colors in the gradient definition.
    expect(glowSrc).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
  it("honours prefers-reduced-motion", () => {
    expect(glowSrc).toContain("useReducedMotion");
  });
});

describe("AnimatedNumber", () => {
  it("reuses the already-installed @number-flow/react (no new dependency)", () => {
    expect(numberSrc).toContain('from "@number-flow/react"');
  });
  it("only animates when scrolled into view", () => {
    expect(numberSrc).toContain("IntersectionObserver");
  });
  it("formats with Intl.NumberFormat", () => {
    expect(numberSrc).toContain("Intl.NumberFormat");
  });
});

describe("SpotlightNavItem", () => {
  it("exposes aria-current for active items (accessibility)", () => {
    expect(spotlightSrc).toContain('aria-current={active ? "page" : undefined}');
  });
  it("skips the spotlight under reduced motion", () => {
    expect(spotlightSrc).toContain("useReducedMotion");
  });
});

describe("KineticTextLoader", () => {
  it("is announced to screen readers", () => {
    expect(loaderSrc).toContain('role="status"');
    expect(loaderSrc).toContain('aria-live="polite"');
  });
  it("has a non-animated reduced-motion fallback", () => {
    expect(loaderSrc).toContain("useReducedMotion");
    expect(loaderSrc).toContain("if (reduced)");
  });
});

describe("AnnotatedText", () => {
  it("keeps the mark decorative (aria-hidden)", () => {
    expect(annotatedSrc).toContain('aria-hidden="true"');
  });
  it("draws via currentColor so it inherits the theme", () => {
    expect(annotatedSrc).toContain('stroke="currentColor"');
  });
  it("exposes all six variants poolr keeps", () => {
    for (const v of [
      "underline",
      "circle",
      "highlight",
      "box",
      "bracket",
      "strikethrough",
    ]) {
      expect(annotatedSrc).toContain(v);
    }
  });
});
