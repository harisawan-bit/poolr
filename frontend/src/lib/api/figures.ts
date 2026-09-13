// Figure and visualization API calls (ROR, diagnostic figures, citations export)
import { postJson } from "./client";

// ── RoB Figures ──────────────────────────────────────────────────────

export interface RobFigureRequest {
  studies: string[];
  domains: string[];
  judgements: string[][];
  weights?: number[];
}

export async function fetchRobFigure(req: RobFigureRequest, type: "traffic" | "summary"): Promise<string> {
  return await postJson<string>(type === "traffic" ? "/api/figure/rob_traffic" : "/api/figure/rob_summary", req);
}

// ── Diagnostic Figures ───────────────────────────────────────────────

export interface DiagnosticPlotInput {
  measure: string;
  effs: number[];
  vars: number[];
  names: string[];
}

export async function fetchDiagnosticFigure(
  type: "galbraith" | "labbe" | "baujat" | "funnel_contour",
  data: any
): Promise<string> {
  const route =
    type === "galbraith" ? "/api/figure/galbraith"
    : type === "labbe" ? "/api/figure/labbe"
    : type === "baujat" ? "/api/figure/baujat"
    : "/api/figure/funnel_contour";
  return await postJson<string>(route, data);
}
