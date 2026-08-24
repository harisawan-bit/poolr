using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// C# meta-analysis engine. Numerics are guarded by the xUnit suite in
/// engine/Poolr.Engine.Tests (replaces the old Python parity oracle). DO NOT
/// "improve" formulas without re-running that suite.
/// </summary>
public static class Stats
{
    // Abramowitz-Stegun 7.1.26 erf approximation (matches scipy to ~1e-7).
    public static double Erf(double x)
    {
        // sign
        int sign = x < 0 ? -1 : 1;
        x = Math.Abs(x);
        const double a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
        const double a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
        double t = 1.0 / (1.0 + p * x);
        double y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.Exp(-x * x);
        return sign * y;
    }

    // Standard normal CDF — mirrors scipy.stats.norm.cdf.
    public static double NormalCdf(double x)
    {
        return 0.5 * (1.0 + Erf(x / Math.Sqrt(2.0)));
    }

    public static double NormPdf(double x) => Math.Exp(-0.5 * x * x) / Math.Sqrt(2.0 * Math.PI);

    public static double KendallTauP(List<double> x, List<double> y)
    {
        int n = x.Count;
        int concordant = 0, discordant = 0;
        for (int i = 0; i < n; i++)
            for (int j = i + 1; j < n; j++)
            {
                double dx = x[i] - x[j];
                double dy = y[i] - y[j];
                if (dx == 0 || dy == 0) continue;
                if (dx * dy > 0) concordant++;
                else discordant++;
            }
        int total = concordant + discordant;
        if (total == 0) return 1.0;
        double tau = (double)(concordant - discordant) / Math.Sqrt(total * total);
        // variance for large n
        int n0 = x.Count;
        double var = (4.0 * n0 + 10.0) / (9.0 * n0 * (n0 - 1.0));
        if (var <= 0) return 1.0;
        double z = tau / Math.Sqrt(var);
        return 2.0 * (1.0 - NormalCdf(Math.Abs(z)));
    }

    // Weighted least-squares slope/intercept for meta-regression.
    public static (double slope, double intercept, double seSlope, double z, double p) Wls(
        List<double> x, List<double> y, List<double> w)
    {
        int n = x.Count;
        double sumW = 0, sumWx = 0, sumWy = 0, sumWx2 = 0, sumWxy = 0;
        for (int i = 0; i < n; i++)
        {
            sumW += w[i];
            sumWx += w[i] * x[i];
            sumWy += w[i] * y[i];
            sumWx2 += w[i] * x[i] * x[i];
            sumWxy += w[i] * x[i] * y[i];
        }
        double denom = sumW * sumWx2 - sumWx * sumWx;
        double slope = (sumW * sumWxy - sumWx * sumWy) / denom;
        double intercept = (sumWy - slope * sumWx) / sumW;
        double varSlope = sumW / denom;
        double seSlope = Math.Sqrt(Math.Max(varSlope, 0));
        double z = slope / (seSlope == 0 ? 1e-12 : seSlope);
        double p = 2.0 * (1.0 - NormalCdf(Math.Abs(z)));
        return (slope, intercept, seSlope, z, p);
    }
}

public class MetaAnalysis
{
    private readonly string _model;
    private readonly string _measure;
    private readonly string _method;
    private readonly string _subgroup;
    private readonly string _pubBias;

    public MetaAnalysis(string model = "random", string measure = "OR",
        string method = "DL", string subgroup = "none", string pubBias = "none")
    {
        _model = model;
        _measure = measure;
        _method = method;
        _subgroup = subgroup;
        _pubBias = pubBias;
    }

    public MetaResponse Run(List<Study> data)
    {
        if (data == null || data.Count == 0)
            throw new ArgumentException("No data provided");

        var validMeasures = new[] { "OR", "RR", "RD", "MD", "SMD", "HR" };
        var validModels = new[] { "random", "fixed" };
        var validMethods = new[] { "DL", "REML", "PM", "HS", "ML", "EB" };
        if (!validMeasures.Contains(_measure))
            throw new ArgumentException($"Invalid effect measure '{_measure}'");
        if (!validModels.Contains(_model))
            throw new ArgumentException($"Invalid model '{_model}'");
        if (!validMethods.Contains(_method))
            throw new ArgumentException($"Invalid method '{_method}'");

        var binary = data.Where(s => s.type == "binary").ToList();
        var continuous = data.Where(s => s.type == "continuous").ToList();
        var survival = data.Where(s => s.type == "survival").ToList();

        if ((_measure is "OR" or "RR" or "RD") && binary.Count > 0)
            return RunBinary(binary);
        if ((_measure is "MD" or "SMD") && continuous.Count > 0)
            return RunContinuous(continuous);
        if (_measure == "HR" && survival.Count > 0)
            return RunSurvival(survival);
        if (binary.Count > 0)
            return RunBinary(binary);
        throw new ArgumentException($"No valid data for measure {_measure}");
    }

    private class Work
    {
        public Study S = null!;
        public double Effect;
        public double Var;
        public double Weight;
    }

    private MetaResponse RunBinary(List<Study> studies)
    {
        var works = new List<Work>();
        foreach (var s in studies)
        {
            if (s.int_events == null || s.int_n == null || s.ctrl_events == null || s.ctrl_n == null)
                continue;
            double a = s.int_events.Value, b = s.int_n.Value - s.int_events.Value;
            double c = s.ctrl_events.Value, d = s.ctrl_n.Value - s.ctrl_events.Value;
            if (a == 0 || b == 0 || c == 0 || d == 0) { a += 0.5; b += 0.5; c += 0.5; d += 0.5; }

            double effect, var;
            if (_measure == "OR")
            {
                effect = Math.Log((a * d) / (b * c));
                var = 1 / a + 1 / b + 1 / c + 1 / d;
            }
            else if (_measure == "RR")
            {
                effect = Math.Log((a / s.int_n.Value) / (c / s.ctrl_n.Value));
                // NOTE: s.int_n / s.ctrl_n are int, so use 1.0 to force floating-point
                // division. `1 / s.int_n.Value` would be integer division (=0) and silently
                // drop the correction term — matching python/poolr/meta/analysis.py requires floats.
                var = (1.0 / a - 1.0 / s.int_n.Value) + (1.0 / c - 1.0 / s.ctrl_n.Value);
            }
            else // RD
            {
                effect = (a / s.int_n.Value) - (c / s.ctrl_n.Value);
                var = (a * b) / Math.Pow(s.int_n.Value, 3) + (c * d) / Math.Pow(s.ctrl_n.Value, 3);
            }
            works.Add(new Work { S = s, Effect = effect, Var = var, Weight = 1 / var });
        }
        return Pool(works, studies.Count);
    }

    private MetaResponse RunContinuous(List<Study> studies)
    {
        var works = new List<Work>();
        foreach (var s in studies)
        {
            double n1 = s.int_n!.Value, n2 = s.ctrl_n!.Value;
            double m1 = s.int_mean!.Value, m2 = s.ctrl_mean!.Value;
            double sd1 = s.int_sd!.Value, sd2 = s.ctrl_sd!.Value;
            double effect, var;
            if (_measure == "MD")
            {
                effect = m1 - m2;
                var = (sd1 * sd1 / n1) + (sd2 * sd2 / n2);
            }
            else // SMD (Hedges' g)
            {
                double pooledSd = Math.Sqrt(((n1 - 1) * sd1 * sd1 + (n2 - 1) * sd2 * sd2) / (n1 + n2 - 2));
                double d = (m1 - m2) / pooledSd;
                double j = 1 - 3.0 / (4.0 * (n1 + n2) - 9);
                effect = j * d;
                var = (n1 + n2) / (n1 * n2) + (effect * effect) / (2 * (n1 + n2));
            }
            works.Add(new Work { S = s, Effect = effect, Var = var, Weight = 1 / var });
        }
        return Pool(works, studies.Count);
    }

    private MetaResponse RunSurvival(List<Study> studies)
    {
        var works = new List<Work>();
        foreach (var s in studies)
        {
            double hr = s.hr!.Value, lower = s.hr_lower!.Value, upper = s.hr_upper!.Value;
            double effect = Math.Log(hr);
            double se = (Math.Log(upper) - Math.Log(lower)) / (2 * 1.96);
            double var = se * se;
            works.Add(new Work { S = s, Effect = effect, Var = var, Weight = 1 / var });
        }
        return Pool(works, studies.Count);
    }

    private MetaResponse Pool(List<Work> works, int k)
    {
        if (works.Count == 0) throw new ArgumentException("No valid studies");
        var effects = works.Select(w => w.Effect).ToList();
        var variances = works.Select(w => w.Var).ToList();
        var weights = works.Select(w => w.Weight).ToList();

        // Fixed-effect
        double sumW = weights.Sum();
        double feEffect = weights.Zip(effects, (w, e) => w * e).Sum() / sumW;
        double feVar = 1 / sumW;
        double feSe = Math.Sqrt(feVar);
        double feZ = feEffect / feSe;
        double feP = 2 * (1 - Stats.NormalCdf(Math.Abs(feZ)));

        // Heterogeneity
        double q = weights.Zip(effects, (w, e) => w * Math.Pow(e - feEffect, 2)).Sum();
        int df = k - 1;
        double qP = df > 0 ? 1 - Chi2Cdf(q, df) : 1;
        double i2 = (q > df && q > 0) ? Math.Max(0, (q - df) / q * 100) : 0;

        // tau^2
        double tau2;
        double c = sumW - weights.Sum(w => w * w) / sumW;
        if (_method == "DL")
            tau2 = (df > 0 && q > df) ? Math.Max(0, (q - df) / c) : 0;
        else if (_method == "REML")
            tau2 = RemlTau2(effects, variances);
        else if (_method == "PM")
            tau2 = PauleMandelTau2(effects, variances, k);
        else if (_method == "HS")
            tau2 = HunterSchmidtTau2(effects, variances, weights, sumW, feEffect, k);
        else
            tau2 = (df > 0 && q > df) ? Math.Max(0, (q - df) / c) : 0;

        // Random-effects
        var reWeights = variances.Select(v => 1 / (v + tau2)).ToList();
        double sumReW = reWeights.Sum();
        double reEffect = reWeights.Zip(effects, (w, e) => w * e).Sum() / sumReW;
        double reVar = 1 / sumReW;
        double reSe = Math.Sqrt(reVar);
        double reZ = reEffect / reSe;
        double reP = 2 * (1 - Stats.NormalCdf(Math.Abs(reZ)));

        double finalEffect, finalSe, finalZ, finalP;
        string finalModel;
        if (_model == "random")
        {
            finalEffect = reEffect; finalSe = reSe; finalZ = reZ; finalP = reP;
            finalModel = "Random-effects";
        }
        else
        {
            finalEffect = feEffect; finalSe = feSe; finalZ = feZ; finalP = feP;
            finalModel = "Fixed-effect";
        }

        bool logScale = _measure is "OR" or "RR" or "HR";
        double est = logScale ? Math.Exp(finalEffect) : finalEffect;
        double lo = logScale ? Math.Exp(finalEffect - 1.96 * finalSe) : finalEffect - 1.96 * finalSe;
        double hi = logScale ? Math.Exp(finalEffect + 1.96 * finalSe) : finalEffect + 1.96 * finalSe;

        var studyResults = new List<StudyResult>();
        double totalWeight = _model == "fixed" ? sumW : sumReW;
        for (int i = 0; i < works.Count; i++)
        {
            var w = _model == "fixed" ? weights[i] : reWeights[i];
            double wp = w / totalWeight * 100;
            double se = Math.Sqrt(works[i].Var);
            studyResults.Add(new StudyResult
            {
                study = works[i].S.study ?? "Unknown",
                effect = logScale ? Math.Exp(works[i].Effect) : works[i].Effect,
                ci_lower = logScale ? Math.Exp(works[i].Effect - 1.96 * se) : works[i].Effect - 1.96 * se,
                ci_upper = logScale ? Math.Exp(works[i].Effect + 1.96 * se) : works[i].Effect + 1.96 * se,
                weight = wp,
                subgroup = works[i].S.subgroup ?? "",
            });
        }

        var resp = new MetaResponse
        {
            model = finalModel,
            measure = _measure,
            method = _method,
            k = works.Count,
            studies = studyResults,
            pooled = new PooledResult
            {
                effect = est,
                ci_lower = lo,
                ci_upper = hi,
                se = finalSe,
                z = finalZ,
                p = finalP,
                model = finalModel,
            },
            heterogeneity = new Heterogeneity
            {
                q = q,
                df = df,
                q_p = qP,
                i2 = i2,
                tau2 = tau2,
                tau = Math.Sqrt(Math.Max(tau2, 0)),
            },
        };

        if (_subgroup != "none")
            resp.subgroups = RunSubgroup(works);
        if (_pubBias != "none" && k >= 3)
            resp.publication_bias = TestPublicationBias(effects, variances, k);
        if (works.Select(w => w.S.year).Where(y => y.HasValue).Select(y => y!.Value).Distinct().Count() > 2)
            resp.meta_regression = RunMetaRegression(works, effects, variances);

        return resp;
    }

    private List<SubgroupResult> RunSubgroup(List<Work> works)
    {
        var groups = new Dictionary<string, List<Work>>();
        foreach (var w in works)
        {
            var key = (w.S.GetType().GetProperty(_subgroup)?.GetValue(w.S) as string) ?? "Unknown";
            if (!groups.ContainsKey(key)) groups[key] = new();
            groups[key].Add(w);
        }
        var res = new List<SubgroupResult>();
        foreach (var g in groups)
        {
            var ws = g.Value;
            var wts = ws.Select(x => x.Weight).ToList();
            double sw = wts.Sum();
            double pooled = ws.Zip(wts, (x, wt) => wt * x.Effect).Sum() / sw;
            double se = Math.Sqrt(1 / sw);
            bool logScale = _measure is "OR" or "RR" or "HR";
            res.Add(new SubgroupResult
            {
                name = g.Key,
                measure = _measure,
                effect = logScale ? Math.Exp(pooled) : pooled,
                ci_lower = logScale ? Math.Exp(pooled - 1.96 * se) : pooled - 1.96 * se,
                ci_upper = logScale ? Math.Exp(pooled + 1.96 * se) : pooled + 1.96 * se,
                k = ws.Count,
            });
        }
        return res;
    }

    private PublicationBias TestPublicationBias(List<double> effects, List<double> variances, int k)
    {
        var pb = new PublicationBias();
        if (_pubBias is "egger" or "all")
        {
            var ses = variances.Select(v => Math.Sqrt(v)).ToList();
            var precision = ses.Select(s => 1 / s).ToList();
            if (precision.Distinct().Count() > 1 && effects.Distinct().Count() > 1)
            {
                var (slope, intercept, _, _, p) = Linreg(precision, effects);
                pb.egger = new EggerResult { intercept = intercept, p_value = p, significant = p < 0.05 };
            }
            else
                pb.egger = new EggerResult { intercept = 0, p_value = 1.0, significant = false, note = "Insufficient variation for Egger's test" };
        }
        if (_pubBias is "begg" or "all")
        {
            if (effects.Distinct().Count() > 1 && variances.Distinct().Count() > 1)
                pb.begg = new BeggResult { tau = 0, p_value = Stats.KendallTauP(effects, variances), significant = Stats.KendallTauP(effects, variances) < 0.05 };
            else
                pb.begg = new BeggResult { tau = 0, p_value = 1.0, significant = false };
        }
        return pb;
    }

    private MetaRegressionResult? RunMetaRegression(List<Work> works, List<double> effects, List<double> variances)
    {
        var years = new List<int>();
        var idx = new List<int>();
        for (int i = 0; i < works.Count; i++)
        {
            var y = works[i].S.year;
            if (y.HasValue && y.Value > 1900) { years.Add(y.Value); idx.Add(i); }
        }
        if (years.Count < 3) return null;
        double meanYear = years.Average();
        var xc = years.Select(yr => (double)(yr - meanYear)).ToList();
        var yv = idx.Select(i => effects[i]).ToList();
        var wv = idx.Select(i => 1 / variances[i]).ToList();
        var (slope, _, se, z, p) = Stats.Wls(xc, yv, wv);
        return new MetaRegressionResult { covariate = "year", slope = slope, se = se, z = z, p = p };
    }

    // ---- helpers mirroring python module-level stat functions ----
    private static (double slope, double intercept, double se, double z, double p) Linreg(List<double> x, List<double> y)
    {
        int n = x.Count;
        double sx = x.Sum(), sy = y.Sum(), sxx = x.Sum(v => v * v), sxy = x.Zip(y, (a, b) => a * b).Sum();
        double denom = n * sxx - sx * sx;
        double slope = (n * sxy - sx * sy) / denom;
        double intercept = (sy - slope * sx) / n;
        double ssRes = y.Zip(x, (yi, xi) => yi - (slope * xi + intercept)).Sum(d => d * d);
        double seSlope = Math.Sqrt(ssRes / (n - 2) / (sxx - sx * sx / n));
        double z = slope / (seSlope == 0 ? 1e-12 : seSlope);
        double p = 2 * (1 - Stats.NormalCdf(Math.Abs(z)));
        return (slope, intercept, seSlope, z, p);
    }

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
        double Q(double t)
        {
            var w = variances.Select(v => 1 / (v + t)).ToList();
            double sw = w.Sum();
            double pooled = w.Zip(effects, (wt, e) => wt * e).Sum() / sw;
            return w.Zip(effects, (wt, e) => wt * Math.Pow(e - pooled, 2)).Sum();
        }
        double target = k - 1;
        double lo = 0, hi = 10;
        for (int i = 0; i < 50; i++)
        {
            double mid = (lo + hi) / 2;
            if (Q(mid) > target) lo = mid; else hi = mid;
        }
        return Math.Max(0, (lo + hi) / 2);
    }

    private static double HunterSchmidtTau2(List<double> effects, List<double> variances, List<double> weights, double sumW, double fe, int k)
    {
        if (k < 2) return 0;
        double vObs = weights.Zip(effects, (wt, e) => wt * Math.Pow(e - fe, 2)).Sum() / sumW;
        double vExp = 1 / sumW * (k - 1) / k;
        return Math.Max(0, vObs - vExp);
    }

    // Chi-square CDF (series) — matches scipy.stats.chi2.cdf well enough for p-values.
    private static double Chi2Cdf(double x, int df)
    {
        if (x <= 0) return 0;
        // regularized lower incomplete gamma; use series for integer df
        double a = df / 2.0;
        double xx = x / 2.0;
        // ln(gamma(a)) via Lanczos for a possibly half-integer
        double sum = 1.0 / a;
        double term = 1.0 / a;
        for (int n = 1; n < 200; n++)
        {
            term *= xx / (a + n);
            sum += term;
            if (term / sum < 1e-12) break;
        }
        double gam = Math.Exp(a * Math.Log(xx) - xx) * sum;
        double gamm = Gamma(a);
        return Math.Min(1, gam / gamm);
    }

    private static double Gamma(double z)
    {
        // Lanczos approximation
        double[] c = {676.5203681218851,-1259.1392167224028,771.32342877765313,
            -176.61502916214059,12.507343278686905,-0.13857109526572012,
            9.9843695780195716e-6,1.5056327351493116e-7};
        if (z < 0.5) return Math.PI / (Math.Sin(Math.PI * z) * Gamma(1 - z));
        z -= 1;
        double x = 0.99999999999980993;
        for (int i = 0; i < 8; i++) x += c[i] / (z + i + 1);
        double t = z + 7.5;
        return Math.Sqrt(2 * Math.PI) * Math.Pow(t, z + 0.5) * Math.Exp(-t) * x;
    }
}
