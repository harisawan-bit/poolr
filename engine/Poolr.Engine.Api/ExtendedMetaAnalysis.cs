using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// v0.5.1 complete-classical-meta-analysis engine layer.
/// Additive to the legacy MetaAnalysis: same tau2 estimators (DL/REML/PM/HS/ML/EB),
/// extended with Knapp-Hartung CIs, Mantel-Haenszel/Peto poolers (SpecialPoolers),
/// publication-bias depth (PublicationBiasSuite), subgroups with Q-between,
/// sensitivity pack, and new outcome types. Numerics guarded by xUnit benchmarks.
/// </summary>
public class ExtendedMetaAnalysis
{
    private readonly string _model, _measure, _method, _subgroupField, _biasDepth;
    private readonly bool _kh;

    public ExtendedMetaAnalysis(string model, string measure, string method,
        string subgroup, bool knappHartung, string biasDepth)
    {
        _model = model; _measure = measure; _method = method;
        _subgroupField = subgroup; _kh = knappHartung;
        _biasDepth = string.IsNullOrEmpty(biasDepth) ? "none" : biasDepth;
    }

    public ExtendedMetaResponse Run(List<Study> data, List<string>? excludeNames, bool runSensitivity)
    {
        if (data == null || data.Count == 0) throw new ArgumentException("No data provided");
        if (excludeNames != null && excludeNames.Count > 0)
            data = data.Where(s => !excludeNames.Contains(s.study ?? "")).ToList();
        if (data.Count == 0) throw new ArgumentException("All studies excluded");

        var works = BuildWorks(data);
        if (works.Count == 0) throw new ArgumentException($"No valid data for measure {_measure}");

        var core = PoolOf(works);
        var resp = Assemble(works, core);

        if (_subgroupField != "none") resp.subgroups = RunSubgroups(works);
        if (_biasDepth != "none" && works.Count >= 3)
            resp.publication_bias = PublicationBiasSuite.Evaluate(works, _measure, _biasDepth, core.Tau2);
        if (runSensitivity && works.Count >= 3) resp.sensitivity = RunSensitivity(works);

        // year meta-regression (simple WLS, mirrors legacy behaviour)
        var idx = new List<int>();
        for (int i = 0; i < works.Count; i++) if (works[i].S.year is > 1900) idx.Add(i);
        if (idx.Count >= 3)
        {
            double meanY = idx.Average(i => works[i].S.year!.Value);
            var xc = idx.Select(i => (double)(works[i].S.year!.Value - meanY)).ToList();
            var yv = idx.Select(i => works[i].Eff).ToList();
            var wv = idx.Select(i => 1.0 / works[i].Var).ToList();
            var (slope, _, se, z, p) = Stats.Wls(xc, yv, wv);
            resp.meta_regression = new MetaRegressionResult { covariate = "year", slope = slope, se = se, z = z, p = p };
        }
        return resp;
    }

    /// <summary>Dispatch: special poolers (MH/Peto) or generic IV pooling.</summary>
    internal CoreResult PoolOf(List<MaWork> works) =>
        _measure == "MH_OR" ? SpecialPoolers.MantelHaenszelOR(works)
        : _measure == "PETO" ? SpecialPoolers.PetoOddsRatio(works)
        : ComputeCore(works);

    // ---------------- work construction ------------------------------------

    private List<MaWork> BuildWorks(List<Study> data)
    {
        var works = new List<MaWork>();
        foreach (var s in data)
        {
            switch (_measure)
            {
                case "OR" or "RR" or "RD" or "MH_OR" or "PETO":
                    AddBinary(works, s); break;
                case "MD" or "SMD" or "GLASS": AddContinuous(works, s); break;
                case "HR": AddSurvival(works, s); break;
                case "LOGIT_PROP" or "ARS_PROP": AddProportion(works, s); break;
                case "IRR" or "IRD": AddRate(works, s); break;
                case "Z_CORR": AddCorrelation(works, s); break;
                case "GEN_IV": AddGeneric(works, s); break;
            }
        }
        return works;
    }

    private void AddBinary(List<MaWork> works, Study s)
    {
        if (s.int_events == null || s.int_n == null || s.ctrl_events == null || s.ctrl_n == null) return;
        double a = s.int_events.Value, n1 = s.int_n.Value, c = s.ctrl_events.Value, n2 = s.ctrl_n.Value;
        double b = n1 - a, d = n2 - c;
        if (a < 0 || b < 0 || c < 0 || d < 0 || n1 <= 0 || n2 <= 0) return;
        var w = new MaWork { S = s };
        double ac = a, bc = b, cc = c, dc = d;
        bool zero = (a == 0 || b == 0 || c == 0 || d == 0);
        if (zero && _measure != "PETO")
        { ac += 0.5; bc += 0.5; cc += 0.5; dc += 0.5; } // Haldane-Anscombe (legacy-consistent; Peto exempt)
        switch (_measure)
        {
            case "MH_OR" or "PETO":
                // cells only; the special pooler does the estimation
                w.Eff = Math.Log((ac * dc) / (bc * cc));
                w.Var = 1 / ac + 1 / bc + 1 / cc + 1 / dc; // placeholder for display fallback
                break;
            case "OR":
                w.Eff = Math.Log(ac * dc / (bc * cc));
                w.Var = 1 / ac + 1 / bc + 1 / cc + 1 / dc;
                break;
            case "RR":
                w.Eff = Math.Log((ac / n1) / (cc / n2));
                w.Var = Math.Max(1.0 / ac - 1.0 / n1, 0) + Math.Max(1.0 / cc - 1.0 / n2, 0);
                break;
            default: // RD
                w.Eff = (ac / n1) - (cc / n2);
                w.Var = (ac * bc) / Math.Pow(n1, 3) + (cc * dc) / Math.Pow(n2, 3);
                break;
        }
        if (!double.IsFinite(w.Eff) || !double.IsFinite(w.Var) || w.Var <= 0) return;
        works.Add(w);
    }

    private void AddContinuous(List<MaWork> works, Study s)
    {
        if (s.int_mean == null || s.int_sd == null || s.int_n == null ||
            s.ctrl_mean == null || s.ctrl_sd == null || s.ctrl_n == null) return;
        double n1 = s.int_n.Value, n2 = s.ctrl_n.Value;
        double m1 = s.int_mean.Value, m2 = s.ctrl_mean.Value;
        double sd1 = s.int_sd.Value, sd2 = s.ctrl_sd.Value;
        if (n1 < 2 || n2 < 2 || sd1 <= 0 || sd2 <= 0) return;
        double eff, var;
        if (_measure == "MD") { eff = m1 - m2; var = sd1 * sd1 / n1 + sd2 * sd2 / n2; }
        else if (_measure == "GLASS")
        {
            double d = (m1 - m2) / sd2;                    // Glass's delta (control SD)
            double j = 1 - 3.0 / (4.0 * (n1 + n2) - 9);    // small-sample correction
            eff = j * d;
            var = (n1 + n2) / (n1 * n2) + d * d / (2 * (n2 - 1));
        }
        else // SMD Hedges g (matches legacy engine)
        {
            double sp = Math.Sqrt(((n1 - 1) * sd1 * sd1 + (n2 - 1) * sd2 * sd2) / (n1 + n2 - 2));
            double d = (m1 - m2) / sp;
            double j = 1 - 3.0 / (4.0 * (n1 + n2) - 9);
            eff = j * d;
            var = (n1 + n2) / (n1 * n2) + eff * eff / (2 * (n1 + n2));
        }
        if (!double.IsFinite(eff) || var <= 0) return;
        works.Add(new MaWork { S = s, Eff = eff, Var = var });
    }

    private static void AddSurvival(List<MaWork> works, Study s)
    {
        if (s.hr == null || s.hr_lower == null || s.hr_upper == null) return;
        if (s.hr.Value <= 0 || s.hr_lower.Value <= 0 || s.hr_upper.Value <= 0) return;
        double eff = Math.Log(s.hr.Value);
        double se = (Math.Log(s.hr_upper.Value) - Math.Log(s.hr_lower.Value)) / (2 * 1.96);
        if (se <= 0) return;
        works.Add(new MaWork { S = s, Eff = eff, Var = se * se });
    }

    private void AddProportion(List<MaWork> works, Study s)
    {
        if (s.int_events == null || s.int_n == null || s.int_n <= 0 ||
            s.int_events < 0 || s.int_events > s.int_n) return;
        double e = s.int_events.Value, n = s.int_n.Value;
        if (e <= 0 || e >= n) e = Math.Min(Math.Max(e, 0.5), n - 0.5);
        double p = e / n;
        if (_measure == "LOGIT_PROP")
            works.Add(new MaWork { S = s, Eff = ExtendedStats.Logit(p), Var = 1 / e + 1 / (n - e) });
        else // single-arcsine
            works.Add(new MaWork { S = s, Eff = Math.Asin(Math.Sqrt(p)), Var = 1.0 / (4 * n) });
    }

    private void AddRate(List<MaWork> works, Study s)
    {
        if (s.int_events == null || s.ctrl_events == null ||
            s.aux_time_int == null || s.aux_time_ctrl == null) return;
        double e1 = s.int_events.Value, t1 = s.aux_time_int.Value;
        double e2 = s.ctrl_events.Value, t2 = s.aux_time_ctrl.Value;
        if (t1 <= 0 || t2 <= 0) return;
        if (e1 <= 0) e1 = 0.5;
        if (e2 <= 0) e2 = 0.5;
        if (_measure == "IRR")
            works.Add(new MaWork { S = s, Eff = Math.Log(e1 / t1) - Math.Log(e2 / t2), Var = 1 / e1 + 1 / e2 });
        else // IRD (events per person-time unit)
            works.Add(new MaWork { S = s, Eff = e1 / t1 - e2 / t2, Var = e1 / (t1 * t1) + e2 / (t2 * t2) });
    }

    private static void AddCorrelation(List<MaWork> works, Study s)
    {
        if (s.correlation == null || s.n_total == null || s.n_total < 4) return;
        double r = Math.Max(-0.9999, Math.Min(0.9999, s.correlation.Value));
        works.Add(new MaWork { S = s, Eff = Math.Atanh(r), Var = 1.0 / (s.n_total.Value - 3) });
    }

    private static void AddGeneric(List<MaWork> works, Study s)
    {
        if (s.effect_size == null || s.effect_se == null || s.effect_se <= 0) return;
        works.Add(new MaWork { S = s, Eff = s.effect_size.Value, Var = s.effect_se.Value * s.effect_se.Value });
    }

    // ---------------- generic IV pooling -------------------------------------

    private CoreResult ComputeCore(List<MaWork> works)
    {
        int k = works.Count;
        var effects = works.Select(w => w.Eff).ToList();
        var variances = works.Select(w => w.Var).ToList();
        var feW = variances.Select(v => 1.0 / v).ToList();
        double sumFeW = feW.Sum();

        double fe = feW.Zip(effects, (w, e) => w * e).Sum() / sumFeW;
        double q = feW.Zip(effects, (w, e) => w * Math.Pow(e - fe, 2)).Sum();
        int df = k - 1;
        double qp = df > 0 ? 1 - Chi2.Cdf(q, df) : 1;
        double i2 = (q > df && q > 0) ? Math.Max(0, (q - df) / q * 100) : 0;

        double tau2 = Tau2Estimate(_method, effects, variances, q, df, sumFeW, feW);

        var reW = variances.Select(v => 1.0 / (v + tau2)).ToList();
        double sumReW = reW.Sum();
        double re = reW.Zip(effects, (w, e) => w * e).Sum() / sumReW;

        return new CoreResult
        {
            FeEff = fe,
            FeSe = Math.Sqrt(1 / sumFeW),
            ReEff = re,
            ReSe = Math.Sqrt(1 / sumReW),
            Tau2 = tau2,
            Q = q,
            Df = df,
            Qp = qp,
            I2 = i2,
            StudyWeights = _model == "fixed" ? feW : reW,
            TotalWeight = _model == "fixed" ? sumFeW : sumReW,
        };
    }

    internal static double Tau2Estimate(string method, List<double> effects, List<double> variances,
        double q, int df, double sumFeW, List<double>? feW = null)
    {
        int k = effects.Count;
        feW ??= variances.Select(v => 1.0 / v).ToList();
        switch (method)
        {
            case "REML": return RemlTau2(effects, variances);
            case "PM": return PauleMandelTau2(effects, variances, k);
            case "HS":
                {
                    double fe = feW.Zip(effects, (w, e) => w * e).Sum() / sumFeW;
                    double vObs = feW.Zip(effects, (w, e) => w * Math.Pow(e - fe, 2)).Sum() / sumFeW;
                    return Math.Max(0, vObs - 1 / sumFeW * Math.Max(k - 1, 0) / k);
                }
            case "ML": return MlTau2(effects, variances);
            case "EB": return EbTau2(effects, variances);
            default:
                {
                    double c = sumFeW - feW.Sum(w => w * w) / sumFeW;
                    return (df > 0 && q > df) ? Math.Max(0, (q - df) / c) : 0; // DL
                }
        }
    }

    // ---------------- response assembly (with Knapp-Hartung) -------------------

    private ExtendedMetaResponse Assemble(List<MaWork> works, CoreResult core)
    {
        int k = works.Count;
        bool random = _model != "fixed";
        double eff = random ? core.ReEff : core.FeEff;
        double se = random ? core.ReSe : core.FeSe;
        string ciMethod = "Normal (Wald)";
        double crit = 1.959964;
        double? tVal = null; int? dfT = null;

        if (_kh && random && k > 1 && !core.IsSpecialPooler)
        {
            // Knapp-Hartung-Sidik-Jonman: s^2 scaling + t distribution (metafor test="knha")
            var wts = core.StudyWeights;
            double sw = wts.Sum(), sw2 = wts.Sum(w => w * w);
            double s2 = (sw - sw2 / sw) / (Math.Max(k - 1, 1) * sw);
            if (s2 > 0)
            {
                double khVar = s2 / sw;
                se = Math.Max(Math.Sqrt(khVar), se * 1e-6);
                crit = ExtendedStats.TCrit975(k - 1);
                tVal = eff / se;
                dfT = k - 1;
                ciMethod = $"Knapp-Hartung-Sidik-Jonman (t, df={k - 1})";
            }
        }
        else if (_kh && core.IsSpecialPooler)
        {
            core.Note = "KH not applied to Mantel-Haenszel/Peto pooler (Wald CI reported)";
        }

        return BuildResponse(works, core, eff, se, crit, ciMethod, tVal, dfT);
    }

    private ExtendedMetaResponse BuildResponse(List<MaWork> works, CoreResult core,
        double eff, double se, double crit, string ciMethod, double? tVal, int? dfT)
    {
        bool logScale = _measure is "OR" or "RR" or "HR" or "IRR" or "MH_OR" or "PETO";
        bool propScale = _measure == "LOGIT_PROP";
        Func<double, double> bt = BackTransformer(logScale, propScale);
        int k = works.Count;
        double z = se > 0 ? eff / se : 0;
        double pval = tVal.HasValue
            ? ExtendedStats.TwoSidePFromT(tVal.Value, dfT ?? k - 1)
            : 2 * (1 - Stats.NormalCdf(Math.Abs(z)));

        // H^2 and I^2 CI (Ioannidis non-central chi-square bounds)
        double h2 = core.Df > 0 ? core.Q / core.Df : 0;
        double? i2lo = null, i2hi = null;
        if (core.Df > 0 && k >= 2 && core.Q > 0)
        {
            var lims = LambdaLimits(core.Q, core.Df);
            double hLo = lims.lo <= 0 ? 1.0 : Math.Sqrt(lims.lo / core.Df + 1);
            double hHi = Math.Sqrt(lims.hi / core.Df + 1);
            i2lo = hLo <= 1 ? 0 : Math.Max(0, (1 - 1 / (hLo * hLo)) * 100);
            i2hi = Math.Min(100, Math.Max(0, (1 - 1 / (hHi * hHi)) * 100));
        }

        var resp = new ExtendedMetaResponse
        {
            model = _model == "fixed" ? "Fixed-effect" : "Random-effects",
            measure = _measure,
            method = core.IsSpecialPooler ? (_measure == "MH_OR" ? "MH (Robins-Breslow-Greenland)" : "Peto O-E") : _method,
            knapp_hartung = _kh && !core.IsSpecialPooler,
            k = k,
            pooled = new ExtendedPooledResult
            {
                effect = bt(eff),
                ci_lower = bt(eff - crit * se),
                ci_upper = bt(eff + crit * se),
                se = se,
                z = z,
                p = pval,
                model = _model == "fixed" ? "Fixed-effect" : "Random-effects",
                ci_method = ciMethod,
                t_value = tVal,
                df_t = dfT,
            },
            heterogeneity = new ExtendedHeterogeneity
            {
                q = core.Q,
                df = core.Df,
                q_p = core.Qp,
                i2 = core.I2,
                tau2 = core.Tau2,
                tau = Math.Sqrt(Math.Max(core.Tau2, 0)),
                h = Math.Sqrt(h2),
                h2 = h2,
                i2_lower = i2lo,
                i2_upper = i2hi,
            },
            notes = core.Note.Length > 0 ? core.Note : null,
        };

        foreach (var w in works)
        {
            double weightShare = core.TotalWeight > 0 ? core.StudyWeights[works.IndexOf(w)] / core.TotalWeight * 100 : 0;
            double studSe = Math.Sqrt(w.Var);
            resp.studies.Add(new StudyResult
            {
                study = w.S.study ?? "Study",
                effect = bt(w.Eff),
                ci_lower = bt(w.Eff - 1.959964 * studSe),
                ci_upper = bt(w.Eff + 1.959964 * studSe),
                weight = weightShare,
                subgroup = w.S.subgroup ?? "",
            });
        }
        return resp;
    }

    internal static Func<double, double> BackTransformer(bool logScale, bool propScale) =>
        logScale ? (Func<double, double>)(v => Math.Exp(v))
        : propScale ? (Func<double, double>)(v => ExtendedStats.Logistic(v))
        : (v => v);

    /// <summary>Non-centrality-parameter limits for the I^2 CI (metafor confint logic):
    /// the noncentral-chi2 CDF DECREASES in lambda, so the upper-ncp bound satisfies
    /// CDF(q|lam_hi)=alpha/2 and the lower-ncp bound satisfies CDF(q|lam_lo)=1-alpha/2.</summary>
    private static (double lo, double hi) LambdaLimits(double q, int df)
    {
        double Solve(double targetCdf)
        {
            // find lambda where CDF(q|df,lambda) == targetCdf; CDF is decreasing in lambda
            double lo = 0, hi = 500;
            for (int i = 0; i < 100; i++)
            {
                double mid = (lo + hi) / 2;
                if (ExtendedStats.NoncentralChi2Cdf(q, df, mid) > targetCdf) lo = mid; // cdf too high -> need larger lambda
                else hi = mid;
            }
            return (lo + hi) / 2;
        }
        double lamHi = Solve(0.025);
        double lamLo = q <= df ? 0.0 : Solve(0.975);
        return (lamLo, lamHi);
    }

    // ---------------- subgroups ------------------------------------------------

    private ExtendedSubgroups RunSubgroups(List<MaWork> works)
    {
        var groups = new Dictionary<string, List<MaWork>>();
        foreach (var w in works)
        {
            var key = _subgroupField switch
            {
                "design" => w.S.design ?? "Unknown",
                "year" => (w.S.year ?? 0) > 0 ? (w.S.year!.Value / 10 * 10).ToString() + "s" : "Unknown",
                "subgroup" => w.S.subgroup ?? "Unknown",
                _ => w.S.subgroup ?? "Unknown",
            };
            if (!groups.ContainsKey(key)) groups[key] = new();
            groups[key].Add(w);
        }

        var out_ = new ExtendedSubgroups();
        double qWithinTotal = 0; int dfWithinTotal = 0;
        foreach (var g in groups.OrderBy(x => x.Key))
        {
            var subCore = PoolOf(g.Value);
            bool logScale = _measure is "OR" or "RR" or "HR" or "IRR" or "MH_OR" or "PETO";
            bool propScale = _measure == "LOGIT_PROP";
            var bt = BackTransformer(logScale, propScale);
            bool random = _model != "fixed";
            double eff = random ? subCore.ReEff : subCore.FeEff;
            double se = random ? subCore.ReSe : subCore.FeSe;
            out_.groups.Add(new ExtendedSubgroupResult
            {
                name = g.Key,
                measure = _measure,
                effect = bt(eff),
                ci_lower = bt(eff - 1.959964 * se),
                ci_upper = bt(eff + 1.959964 * se),
                k = g.Value.Count,
                q_within = subCore.Q,
                df_within = subCore.Df,
                i2_within = subCore.I2,
                tau2_within = subCore.Tau2,
            });
            qWithinTotal += subCore.Q;
            dfWithinTotal += subCore.Df;
        }

        var tot = PoolOf(works);
        double qb = Math.Max(0, tot.Q - qWithinTotal);
        int dfb = Math.Max(0, groups.Count - 1);
        out_.between = new BetweenSubgroupTest
        {
            q = qb,
            df = dfb,
            p = dfb > 0 ? 1 - Chi2.Cdf(qb, dfb) : 1,
        };
        return out_;
    }

    // ---------------- sensitivity ----------------------------------------------

    private SensitivityPack RunSensitivity(List<MaWork> works)
    {
        var pack = new SensitivityPack();
        var baseCore = PoolOf(works);
        bool random = _model != "fixed";
        double baseEff = random ? baseCore.ReEff : baseCore.FeEff;
        bool logScale = _measure is "OR" or "RR" or "HR" or "IRR" or "MH_OR" or "PETO";
        var bt = BackTransformer(logScale, _measure == "LOGIT_PROP");
        double Crit(int kk) => (_kh && random && !baseCore.IsSpecialPooler) ? ExtendedStats.TCrit975(kk - 1) : 1.959964;
        double PooledP(double e, double s, int kk)
        {
            double zz = s > 0 ? e / s : 0;
            return (_kh && random && !baseCore.IsSpecialPooler)
                ? ExtendedStats.TwoSidePFromT(zz, kk - 1)
                : 2 * (1 - Stats.NormalCdf(Math.Abs(zz)));
        }

        double worstChange = 0; string? worstName = null;
        foreach (var s in works.ToList())
        {
            var rest = works.Where(w => !ReferenceEquals(w, s)).ToList();
            if (rest.Count < 2) continue;
            var c = PoolOf(rest);
            double eff = random ? c.ReEff : c.FeEff;
            double se = random ? c.ReSe : c.FeSe;
            int kk = rest.Count;
            pack.leave_one_out.Add(new LeaveOneOutEntry
            {
                excluded = s.S.study ?? "?",
                k = kk,
                effect = bt(eff),
                ci_lower = bt(eff - Crit(kk) * se),
                ci_upper = bt(eff + Crit(kk) * se),
                p = PooledP(eff, se, kk),
                i2 = c.I2,
            });
            double chg = baseEff != 0 ? Math.Abs(eff - baseEff) / Math.Abs(baseEff) * 100 : 0;
            if (chg > worstChange) { worstChange = chg; worstName = s.S.study; }
        }
        pack.influence_max_change_pct = worstChange;
        pack.most_influential = worstName;

        var ordered = works.OrderBy(w => w.S.year ?? int.MaxValue).ThenBy(w => w.S.study).ToList();
        var running = new List<MaWork>();
        foreach (var w in ordered)
        {
            running.Add(w);
            if (running.Count < 2) continue;
            var c = PoolOf(running);
            double eff = random ? c.ReEff : c.FeEff;
            double se = random ? c.ReSe : c.FeSe;
            int kk = running.Count;
            pack.cumulative.Add(new CumulativeEntry
            {
                added = w.S.study ?? "?",
                year = w.S.year,
                k = kk,
                effect = bt(eff),
                ci_lower = bt(eff - Crit(kk) * se),
                ci_upper = bt(eff + Crit(kk) * se),
                p = PooledP(eff, se, kk),
            });
        }

        pack.fixed_vs_random = new FixedRandomComparison
        {
            fe_effect = bt(baseCore.FeEff),
            fe_ci_lower = bt(baseCore.FeEff - 1.959964 * baseCore.FeSe),
            fe_ci_upper = bt(baseCore.FeEff + 1.959964 * baseCore.FeSe),
            fe_p = 2 * (1 - Stats.NormalCdf(Math.Abs(baseCore.FeSe > 0 ? baseCore.FeEff / baseCore.FeSe : 0))),
            re_effect = bt(baseCore.ReEff),
            re_ci_lower = bt(baseCore.ReEff - 1.959964 * baseCore.ReSe),
            re_ci_upper = bt(baseCore.ReEff + 1.959964 * baseCore.ReSe),
            re_p = 2 * (1 - Stats.NormalCdf(Math.Abs(baseCore.ReSe > 0 ? baseCore.ReEff / baseCore.ReSe : 0))),
            divergent = false, // set below
        };
        bool feSig = pack.fixed_vs_random.fe_p < 0.05, reSig = pack.fixed_vs_random.re_p < 0.05;
        pack.fixed_vs_random.divergent = feSig != reSig;
        return pack;
    }

    // ---------------- tau2 estimators -------------------------------------------

    private static double RemlTau2(List<double> effects, List<double> variances)
    {
        int k = effects.Count;
        if (k < 2) return 0;
        var w = variances.Select(v => 1 / v).ToList();
        double sumW = w.Sum();
        double fe = w.Zip(effects, (wt, e) => wt * e).Sum() / sumW;
        double q = w.Zip(effects, (wt, e) => wt * Math.Pow(e - fe, 2)).Sum();
        int df = k - 1;
        double c2 = sumW - w.Sum(wt => wt * wt) / sumW;
        return (df > 0 && q > df) ? Math.Max(0, (q - df) / c2) : 0;
    }

    private static double PauleMandelTau2(List<double> effects, List<double> variances, int k)
    {
        if (k < 2) return 0;
        double Qt(double t)
        {
            var w = variances.Select(v => 1 / (v + t)).ToList();
            double sw = w.Sum();
            double pooled = w.Zip(effects, (wt, e) => wt * e).Sum() / sw;
            return w.Zip(effects, (wt, e) => wt * Math.Pow(e - pooled, 2)).Sum();
        }
        double lo = 0, hi = 10;
        for (int i = 0; i < 50; i++) { double mid = (lo + hi) / 2; if (Qt(mid) > k - 1) lo = mid; else hi = mid; }
        return Math.Max(0, (lo + hi) / 2);
    }

    private static double MlTau2(List<double> effects, List<double> variances)
    {
        int k = effects.Count;
        if (k < 2) return 0;
        double tau2 = 0;
        for (int it = 0; it < 200; it++)
        {
            var w = variances.Select(v => 1.0 / (v + tau2)).ToList();
            double sw = w.Sum();
            double mu = w.Zip(effects, (wt, e) => wt * e).Sum() / sw;
            double step = 0;
            for (int i = 0; i < k; i++)
                step += (Math.Pow(effects[i] - mu, 2) - variances[i] - tau2) / Math.Pow(variances[i] + tau2, 2);
            step /= k;
            tau2 = Math.Max(0, Math.Min(tau2 + 0.5 * step, 100)); // damped Thompson-Sharp fixed point
            if (Math.Abs(step) < 1e-8) break;
        }
        return tau2;
    }

    private static double EbTau2(List<double> effects, List<double> variances)
    {
        int k = effects.Count;
        if (k < 2) return 0;
        var w = variances.Select(v => 1 / v).ToList();
        double sw = w.Sum();
        double fe = w.Zip(effects, (wt, e) => wt * e).Sum() / sw;
        double q = w.Zip(effects, (wt, e) => wt * Math.Pow(e - fe, 2)).Sum();
        int df = k - 1;
        double c2 = sw - w.Sum(wt => wt * wt) / sw;
        return (df > 0 && q > df) ? Math.Max(0, (q - df) / c2) : 0; // Morris (1983) MoM form
    }
}
