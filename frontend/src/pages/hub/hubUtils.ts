import type { Project } from "../../lib/project";

export const F = (n: number | null | undefined, d = 3): string => {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(d);
};

export interface ExtractedStudyData {
  effects: number[];
  variances: number[];
  standardErrors: number[];
  names: string[];
  sampleSizes: number[];
  binaryData: {
    study: string;
    ai: number;
    n1i: number;
    ci: number;
    n2i: number;
  }[];
  rawStudies: any[];
}

export function getExtractedData(project: Project): ExtractedStudyData {
  const studies = project.extraction?.studies ?? [];
  const effects: number[] = [];
  const variances: number[] = [];
  const standardErrors: number[] = [];
  const names: string[] = [];
  const sampleSizes: number[] = [];
  const binaryData: { study: string; ai: number; n1i: number; ci: number; n2i: number }[] = [];

  for (const s of studies) {
    const name = s.study || `Study ${names.length + 1}`;
    let eff: number | null = null;
    let se: number | null = null;

    if (s.effect_size != null && s.effect_se != null && s.effect_se > 0) {
      eff = s.effect_size;
      se = s.effect_se;
    } else if (s.hr != null && s.hr_lower != null && s.hr_upper != null && s.hr > 0 && s.hr_lower > 0 && s.hr_upper > 0) {
      eff = Math.log(s.hr);
      se = (Math.log(s.hr_upper) - Math.log(s.hr_lower)) / (2 * 1.959964);
    } else if (s.int_events != null && s.int_n != null && s.ctrl_events != null && s.ctrl_n != null) {
      const a = s.int_events;
      const n1 = s.int_n;
      const c = s.ctrl_events;
      const n2 = s.ctrl_n;
      const b = n1 - a;
      const d = n2 - c;
      binaryData.push({ study: name, ai: a, n1i: n1, ci: c, n2i: n2 });
      if (a > 0 && b > 0 && c > 0 && d > 0) {
        eff = Math.log((a * d) / (b * c));
        const v = 1 / a + 1 / b + 1 / c + 1 / d;
        se = Math.sqrt(v);
      }
    }

    if (eff != null && se != null && Number.isFinite(eff) && Number.isFinite(se) && se > 0) {
      effects.push(eff);
      variances.push(se * se);
      standardErrors.push(se);
      names.push(name);
      const n = (s.int_n ?? 0) + (s.ctrl_n ?? 0) || s.n_total || 100;
      sampleSizes.push(n);
    }
  }

  return {
    effects,
    variances,
    standardErrors,
    names,
    sampleSizes,
    binaryData,
    rawStudies: studies,
  };
}

export function downloadFile(filename: string, content: string, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

