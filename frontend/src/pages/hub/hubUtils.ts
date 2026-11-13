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
    } else if (s.type === "continuous" && s.int_mean != null && s.int_sd != null && s.int_n != null && s.ctrl_mean != null && s.ctrl_sd != null && s.ctrl_n != null && s.int_n > 0 && s.ctrl_n > 0) {
      eff = s.int_mean - s.ctrl_mean;
      se = Math.sqrt((s.int_sd * s.int_sd) / s.int_n + (s.ctrl_sd * s.ctrl_sd) / s.ctrl_n);
    } else if (s.type === "correlation" && s.correlation != null && s.n_total != null && s.n_total > 3 && Math.abs(s.correlation) < 1) {
      eff = 0.5 * Math.log((1 + s.correlation) / (1 - s.correlation));
      se = 1 / Math.sqrt(s.n_total - 3);
    } else if (s.type === "proportion" && s.int_events != null && s.int_n != null && s.int_n > 0) {
      const e = s.int_events + 0.5;
      const non = s.int_n - s.int_events + 0.5;
      eff = Math.log(e / non);
      se = Math.sqrt(1 / e + 1 / non);
    } else if (s.type === "rate" && s.int_events != null && s.aux_time_int != null && s.ctrl_events != null && s.aux_time_ctrl != null && s.aux_time_int > 0 && s.aux_time_ctrl > 0) {
      const r1 = (s.int_events + 0.5) / s.aux_time_int;
      const r2 = (s.ctrl_events + 0.5) / s.aux_time_ctrl;
      eff = Math.log(r1 / r2);
      se = Math.sqrt(1 / (s.int_events + 0.5) + 1 / (s.ctrl_events + 0.5));
    } else if (s.int_events != null && s.int_n != null && s.ctrl_events != null && s.ctrl_n != null) {
      const a = s.int_events;
      const n1 = s.int_n;
      const c = s.ctrl_events;
      const n2 = s.ctrl_n;
      const b = n1 - a;
      const d = n2 - c;
      binaryData.push({ study: name, ai: a, n1i: n1, ci: c, n2i: n2 });
      const ca = a === 0 || b === 0 || c === 0 || d === 0 ? a + 0.5 : a;
      const cb = a === 0 || b === 0 || c === 0 || d === 0 ? b + 0.5 : b;
      const cc = a === 0 || b === 0 || c === 0 || d === 0 ? c + 0.5 : c;
      const cd = a === 0 || b === 0 || c === 0 || d === 0 ? d + 0.5 : d;
      if (ca > 0 && cb > 0 && cc > 0 && cd > 0) {
        eff = Math.log((ca * cd) / (cb * cc));
        se = Math.sqrt(1 / ca + 1 / cb + 1 / cc + 1 / cd);
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

