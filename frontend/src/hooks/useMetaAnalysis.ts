/**
 * useMetaAnalysis — extracted core analysis logic from Meta.tsx.
 *
 * Centralizes: run flow, TSA, model averaging, replication code, prediction intervals.
 */
import * as React from "react";
import type { ExtendedMetaRequest, ExtendedMetaResponse } from "../lib/project";
import type { StudyInput } from "../lib/meta";
import { interpretResults } from "../lib/ai";
import {
  runModelAveraging,
  runTrialSequentialAnalysis,
  type PredictionResult,
  type ModelAverageResult,
  type SequentialResult,
} from "../lib/api";

export interface UseMetaAnalysisArgs {
  settings: ExtendedMetaRequest;
  studies: StudyInput[];
  resp: ExtendedMetaResponse | null;
  mounted: React.MutableRefObject<boolean>;
}

export interface MetaAnalysisActions {
  handleRunTsa: () => Promise<void>;
  handleRunModelAveraging: () => Promise<void>;
  handleInterpret: () => Promise<void>;
}

export function useMetaAnalysis({ settings, studies, resp, mounted }: UseMetaAnalysisArgs) {
  const [predInterval, setPredInterval] = React.useState<PredictionResult | null>(null);
  const [tsaResult, setTsaResult] = React.useState<SequentialResult | null>(null);
  const [tsaLoading, setTsaLoading] = React.useState(false);
  const [maResult, setMaResult] = React.useState<ModelAverageResult | null>(null);
  const [maLoading, setMaLoading] = React.useState(false);
  const [replCode, setReplCode] = React.useState<Record<string, string>>({});
  const [replLoading, setReplLoading] = React.useState(false);
  const [interpreting, setInterpreting] = React.useState(false);
  const [interpretation, setInterpretation] = React.useState<string | null>(null);
  const [diagSvg, setDiagSvg] = React.useState<Record<string, string>>({});
  const [diagLoading, setDiagLoading] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Run TSA
  const handleRunTsa = React.useCallback(async () => {
    if (!resp?.studies.length) return;
    setTsaLoading(true);
    try {
      const isRatio = ["OR", "RR", "HR"].includes(settings.measure || "OR");
      const nullVal = isRatio ? 1 : 0;
      const tsaStudies = resp.studies.map((s) => {
        const se = (s as any).se || Math.abs(s.ci_upper - s.ci_lower) / 3.92;
        const z = se > 0 ? (s.effect - nullVal) / se : 0;
        return { study: s.study, zScore: z, informationFraction: (s.weight || 1) / 100 };
      });
      const res = await runTrialSequentialAnalysis({
        studies: tsaStudies, alpha: 0.05, beta: 0.20, expectedEffect: resp.pooled.effect,
      });
      setTsaResult(res);
    } catch (e) {
      console.error("TSA failed:", e);
      setNotice("Trial Sequential Analysis requires the backend engine.");
    } finally {
      if (mounted.current) setTsaLoading(false);
    }
  }, [resp, settings.measure, mounted]);

  // Run model averaging
  const handleRunModelAveraging = React.useCallback(async () => {
    if (!resp?.studies.length) return;
    setMaLoading(true);
    try {
      const effects = resp.studies.map((s) => s.effect);
      const variances = resp.studies.map((s) => {
        const se = (s as any).se || Math.abs(s.ci_upper - s.ci_lower) / 3.92;
        return Math.max(1e-6, se * se);
      });
      const res = await runModelAveraging({ effects, variances });
      setMaResult(res);
    } catch (e) {
      console.error("Model averaging failed:", e);
      setNotice("Model Averaging requires the backend engine.");
    } finally {
      if (mounted.current) setMaLoading(false);
    }
  }, [resp, mounted]);

  // Handle AI interpretation
  const handleInterpret = React.useCallback(async () => {
    if (!resp?.pooled) return;
    setInterpreting(true);
    try {
      const text = await interpretResults({
        pooled: { effect: resp.pooled.effect, ci_lower: resp.pooled.ci_lower, ci_upper: resp.pooled.ci_upper, p: resp.pooled.p },
        heterogeneity: { i2: resp.heterogeneity?.i2 ?? 0, tau2: resp.heterogeneity?.tau2 ?? 0, q_p: resp.heterogeneity?.q_p ?? 1 },
        measure: settings.measure ?? "OR",
      });
      setInterpretation(text);
    } catch {
      setInterpretation("Could not generate interpretation. Check your AI provider settings.");
    } finally {
      if (mounted.current) setInterpreting(false);
    }
  }, [resp, settings.measure, mounted]);

  // Fetch diagnostic SVGs when tab changes
  const studiesRef = React.useRef(studies);
  if (studies !== studiesRef.current) studiesRef.current = studies;

  return {
    // State
    predInterval, setPredInterval,
    tsaResult, tsaLoading,
    maResult, maLoading,
    replCode, setReplCode, replLoading, setReplLoading,
    interpreting, interpretation,
    diagSvg, setDiagSvg, diagLoading, setDiagLoading,
    notice, setNotice,
    // Actions
    handleRunTsa,
    handleRunModelAveraging,
    handleInterpret,
    // Refs
    studiesRef,
  };
}
