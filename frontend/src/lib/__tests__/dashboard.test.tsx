import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Dashboard from "../../pages/Dashboard";
import { dashboardGreeting, greetingPeriod, greetingVariantsPerPeriod } from "../dashboardGreeting";
import { emptyProject } from "../project";

describe("review overview", () => {
  it("starts an empty review at the research question", () => {
    const html = renderToStaticMarkup(<Dashboard project={emptyProject()} onChange={() => {}} />);
    expect(html).toContain("Define your research question");
  });
  it("keeps unresolved conflicts in screening even when every record has a decision", () => {
    const project = emptyProject();
    project.pico.population = "Adults";
    project.screening.title_abstract = [{ id: "one", title: "Trial", abstract: "", stage: "title_abstract", decision: "include", conflictStatus: "pending" }];
    project.screening.full_text = [{ ...project.screening.title_abstract[0], stage: "full_text" }];
    const html = renderToStaticMarkup(<Dashboard project={project} onChange={() => {}} />);
    expect(html).toContain("Continue screening");
    expect(html).toContain("References imported</span><strong>1</strong>");
    expect(html).toContain("1 unresolved conflicts");
  });
  it("masks conflict counts on the overview when screening blinding is enabled", () => {
    const project = emptyProject();
    project.pico.population = "Adults";
    project.screening.blinded = true;
    project.screening.title_abstract = [{ id: "one", title: "Trial", abstract: "", stage: "title_abstract", decision: "include", conflictStatus: "pending" }];
    const html = renderToStaticMarkup(<Dashboard project={project} onChange={() => {}} />);
    expect(html).toContain("Blinded dual pass active");
    expect(html).not.toContain("unresolved conflicts");
  });
});

describe("dashboard greeting", () => {
  it("changes at the local time boundaries and uses the profile name", () => {
    expect([0, 4, 5, 11, 12, 17, 18, 21, 22, 23].map(greetingPeriod))
      .toEqual([3, 3, 0, 0, 1, 1, 2, 2, 3, 3]);
    expect(dashboardGreeting(greetingPeriod(23), 0, " Haris ").title).toBe("Hello, night owl! Good to see you, Haris.");
    expect(dashboardGreeting(greetingPeriod(9), 0).title).toBe("Good morning");
    const html = renderToStaticMarkup(<Dashboard project={emptyProject()} name="Haris" onChange={() => {}} />);
    expect(html).toMatch(/<h2>[^<]*Haris[^<]*<\/h2>/);
  });

  it("rotates through at least 500 distinct greeting and note combinations", () => {
    const combinations = Array.from({ length: 4 }, (_, period) =>
      Array.from({ length: greetingVariantsPerPeriod }, (_, visit) =>
        JSON.stringify(dashboardGreeting(period, visit, "Haris")))).flat();
    expect(new Set(combinations).size).toBe(576);
    expect(dashboardGreeting(3, greetingVariantsPerPeriod)).toEqual(dashboardGreeting(3, 0));
  });
});
