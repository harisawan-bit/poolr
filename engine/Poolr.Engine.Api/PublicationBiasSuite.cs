using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>Publication-bias depth suite (v0.5.1).</summary>
public static class PublicationBiasSuite
{
    public static ExtendedPublicationBias Evaluate(
        List<MaWork> works, string measure, string depth, double tau2)
    {
        var pb = new ExtendedPublicationBias();
        var effs = works.Select(w => w.Eff).ToList();
        var vars = works.Select(w => w.Var).ToList();
        var ses = vars.Select(Math.Sqrt).ToList();
        int k = effs.Count;

        // Egger + Begg at any depth above none
        var prec = ses.Select(s => 1 / s).ToList();
        if (prec.Distinct().Count() > 1 && effs.Distinct().Count() > 1)
        {
            var (_, ic, sei, _, pv) = Regression.OlsIntercept(prec, effs);
            pb.egger = new EggerResult { intercept = ic, p_value = pv, significant = pv < 0.05 };
        }
        else
            pb.egger = new EggerResult { intercept = 0, p_value = 1, significant = false, note = "Insufficient variation" };
        double ktP = Stats.KendallTauP(effs, vars);
        pb.begg = new BeggResult { tau = 0, p_value = ktP, significant = ktP < 0.05 };

        if (depth != "full") return pb;

        pb.trimfill = TrimFill(effs, vars);

        if (measure is "OR" or "RR" or "MH_OR" or "PETO")
            pb.peters_harbord = PetersHarbord(works);

        pb.pet_peese = PetPeese(effs, ses);

        // Henmi-Copas limit meta (DL tau^2), log-scale back-transformed
        {
            var wts = vars.Select(v => 1 / v).ToList();
            double sw = wts.Sum();
            double mu = wts.Zip(effs, (w, e) => w * e).Sum() / sw;
            double t1 = wts.Zip(effs, (w, e) => w * Math.Pow(e - mu, 2)).Sum() / (sw * sw);
            double t2 = vars.Select(v => 1 / (v * v)).Sum() / (sw * sw);
            double seHc = Math.Sqrt(Math.Max(t1 + tau2 * t2, 1e-12));
            pb.limit_meta = new LimitMetaResult
            {
                effect = Math.Exp(mu),
                ci_lower = Math.Exp(mu - 1.959964 * seHc),
                ci_upper = Math.Exp(mu + 1.959964 * seHc),
                note = "Henmi-Copas limit meta (DL tau2; CI robust to small-study effects)",
            };
        }

        pb.pcurve = PCurve(effs, ses);
        pb.selection_3psm = SelectionModels.Fit(effs, vars, logScale: measure is "OR" or "RR" or "HR" or "IRR");
        pb.failsafe_n = FailSafeN(effs, ses);
        return pb;
    }

    /// <summary>Duval-Tweedie L0 trim-and-fill on the log scale (random-effects pooling).</summary>
    internal static TrimFillResult TrimFill(List<double> effs, List<double> vars)
    {
        int k = effs.Count;
        var order = Enumerable.Range(0, k).OrderBy(i => effs[i]).ToList();

        double Rer(List<int> idxs)
        {
            var w = idxs.Select(i => 1 / vars[i]).ToList();
            var e = idxs.Select(i => effs[i]).ToList();
            double sw = w.Sum();
            double fe = w.Zip(e, (wi, ei) => wi * ei).Sum() / sw;
            double q = w.Zip(e, (wi, ei) => wi * Math.Pow(ei - fe, 2)).Sum();
            int df = Math.Max(idxs.Count - 1, 0);
            double c = sw - w.Sum(wi => wi * wi) / sw;
            double t2 = (df > 0 && q > df && c > 0) ? Math.Max(0, (q - df) / c) : 0;
            var rw = idxs.Select(i => 1 / (vars[i] + t2)).ToList();
            double srw = rw.Sum();
            return rw.Zip(idxs.Select(i => effs[i]), (wi, ei) => wi * ei).Sum() / srw;
        }

        int lo = 0, hi = k - 2; // can't trim more than k-2
        double thetaR = Rer(order);
        while (lo < hi)
        {
            int mid = (lo + hi) / 2;
            var kept = order.Skip(mid).ToList();
            double th = Rer(kept);
            // count left-side "missing" candidates under current centre
            int nLeft = 0;
            foreach (var i in kept)
            {
                double rank = 0;
                foreach (var j in kept)
                    if (effs[j] < effs[i])
                        rank += (th - effs[j]) / Math.Sqrt(vars[j]);
                rank += kept.Count / 2.0 + 0.5;
                if (rank <= 0) nLeft++;
            }
            if (nLeft >= 1 && nLeft < kept.Count - 1) lo = mid + 1;
            else hi = mid;
            thetaR = th;
        }
        int nTrim = lo;
        double centre = Rer(order.Skip(nTrim).ToList());

        // impute mirrored studies, re-pool with DL random effects
        var augEff = new List<double>(effs);
        var augVar = new List<double>(vars);
        for (int i = 0; i < nTrim; i++)
        {
            augEff.Add(2 * centre - effs[order[i]]);
            augVar.Add(vars[order[i]]);
        }
        var wA = augVar.Select(v => 1 / v).ToList();
        double swA = wA.Sum();
        double feA = wA.Zip(augEff, (w, e) => w * e).Sum() / swA;
        double qA = wA.Zip(augEff, (w, e) => w * Math.Pow(e - feA, 2)).Sum();
        int dfA = Math.Max(augEff.Count - 1, 0);
        double cA = swA - wA.Sum(w => w * w) / swA;
        double tauA = (dfA > 0 && qA > dfA && cA > 0) ? Math.Max(0, (qA - dfA) / cA) : 0;
        var rwA = augVar.Select(v => 1 / (v + tauA)).ToList();
        double srwA = rwA.Sum();
        double reAdj = rwA.Zip(augEff, (w, e) => w * e).Sum() / srwA;
        double seAdj = Math.Sqrt(1 / srwA);

        var res = new TrimFillResult
        {
            n_imputed = nTrim,
            adjusted_effect = Math.Exp(reAdj),
            adjusted_ci_lower = Math.Exp(reAdj - 1.959964 * seAdj),
            adjusted_ci_upper = Math.Exp(reAdj + 1.959964 * seAdj),
            original_effect = Math.Exp(thetaR),
            side = nTrim > 0 ? "right (funnel asymmetry on the right -> imputed mirrored left)" : "none",
            method = "Duval-Tweedie L0 (linear), RE(DL) pooling",
        };
        res.adjusted_studies = new List<StudyResult>();
        for (int i = 0; i < augEff.Count; i++)
        {
            double seI = Math.Sqrt(augVar[i]);
            res.adjusted_studies.Add(new StudyResult
            {
                study = i < k ? $"S{i + 1}" : $"Imputed {i - k + 1}",
                effect = Math.Exp(augEff[i]),
                ci_lower = Math.Exp(augEff[i] - 1.959964 * seI),
                ci_upper = Math.Exp(augEff[i] + 1.959964 * seI),
                weight = rwA[i] / srwA * 100,
                subgroup = "",
            });
        }
        return res;
    }

    /// <summary>Peters (weighted lnOR ~ 1/N) and Harbord (score z ~ sqrt(V)) regression tests.</summary>
    internal static PetersHarbordResult PetersHarbord(List<MaWork> works)
    {
        var xPet = new List<double>(); var yPet = new List<double>(); var wPet = new List<double>();
        var xHarb = new List<double>(); var yHarb = new List<double>();
        foreach (var w in works)
        {
            var s = w.S;
            if (s.int_events == null || s.int_n == null || s.ctrl_events == null || s.ctrl_n == null) continue;
            double a = s.int_events.Value, n1 = s.int_n.Value, c = s.ctrl_events.Value, n2 = s.ctrl_n.Value;
            if ((a == 0 && c == 0) || ((n1 - a) == 0 && (n2 - c) == 0)) continue; // drop00
            bool zero = a == 0 || b0(n1, a) || c == 0 || b0(n2, c);
            if (zero) { a += .5; c += .5; n1 += 1; n2 += 1; } // conservative display correction
            double lor = Math.Log((a / n1) / (1 - a / n1)) + Math.Log((1 - c / n2) / (c / n2));
            double vlor = 1 / a + 1 / (n1 - a) + 1 / c + 1 / (n2 - c);
            xPet.Add(1 / (n1 + n2)); yPet.Add(lor); wPet.Add(1 / vlor);

            double N = n1 + n2, M = a + c;
            double E = n1 * M / N;
            double vb = n1 * n2 * M * (N - M) / (Math.Pow(N, 2) * Math.Max(N - 1, 1));
            if (vb > 0) { xHarb.Add(Math.Sqrt(vb)); yHarb.Add((a - E) / Math.Sqrt(vb)); }
        }
        var res = new PetersHarbordResult();
        if (xPet.Count >= 5)
        {
            var (_, ic, _, _, pv) = Regression.WlsIntercept(xPet, yPet, wPet);
            res.peters_intercept = ic; res.peters_p = pv;
        }
        else res.peters_p = 1;
        if (xHarb.Count >= 5)
        {
            var (_, ic2, _, _, pv2) = Regression.OlsIntercept(xHarb, yHarb);
            res.harbord_intercept = ic2; res.harbord_p = pv2;
        }
        else res.harbord_p = 1;
        res.note = "Peters: weighted lnOR ~ 1/N; Harbord: score z ~ sqrt(V); need >=5 informative studies";
        return res;
    }

    private static bool b0(double n, double ev) => n - ev == 0;

    /// <summary>PET-PEESE (Stanley). PET: OLS y~se; PEESE: precision-weighted y ~ se^2.</summary>
    internal static PetPeeseResult PetPeese(List<double> effs, List<double> ses)
    {
        var res = new PetPeeseResult();
        var (_, petInt, petSe, _, petP) = Regression.OlsIntercept(ses, effs);
        res.pet_intercept = petInt; res.pet_p = petP;

        var x2 = ses.Select(s => s * s).ToList();
        var wts = ses.Select(s => 1 / Math.Max(s * s, 1e-10)).ToList(); // weight = 1/var(yi)
        var (_, peInt, peSe, _, peP) = Regression.WlsIntercept(x2, effs, wts);
        res.peese_intercept = peInt; res.peese_se = peSe; res.peese_p = peP;

        res.interpretation =
            res.pet_p >= 0.05
                ? "PET intercept not significant -> no small-study-effect evidence; use PET-adjusted estimate"
                : (res.peese_p >= 0.05
                    ? "PET significant, PEESE not -> bias indicated; PEESE-adjusted estimate preferred"
                    : "PET & PEESE both significant -> effect likely real but inflated by small-study bias");
        return res;
    }

    /// <summary>p-curve (Simonsohn et al.) — right-skew (evidential value) and left-skew tests.</summary>
    internal static PCurveResult PCurve(List<double> effs, List<double> ses)
    {
        var res = new PCurveResult();
        var pvals = new List<double>();
        for (int i = 0; i < effs.Count; i++)
        {
            double pp = 2 * (1 - Stats.NormalCdf(Math.Abs(effs[i] / ses[i])));
            if (pp < 0.05 && pp > 0) pvals.Add(pp);
        }
        res.k_significant = pvals.Count;
        if (pvals.Count < 3)
        {
            res.interpretation = "Need >=3 statistically significant studies (p<.05)";
            return res;
        }
        double sumLnU = 0, sumLnOneMinusU = 0;
        foreach (var pp in pvals)
        {
            double u = pp / 0.05;
            sumLnU += Math.Log(u);
            sumLnOneMinusU += Math.Log(1 - Math.Min(u, 0.9999999));
        }
        double zRight = sumLnU / Math.Sqrt(pvals.Count);
        res.rightskew_p = Stats.NormalCdf(zRight);              // one-sided: small => evidential value
        double zFlat = -sumLnOneMinusU / Math.Sqrt(pvals.Count);
        res.uniform_p = 1 - Stats.NormalCdf(zFlat);             // one-sided: small => left-skew concern
        res.interpretation =
            res.rightskew_p < 0.05 ? "p-curve right-skewed -> evidential value present"
            : (res.uniform_p < 0.05 ? "p-curve left-skewed -> selective reporting concern"
                                    : "p-curve inconclusive");
        return res;
    }

    /// <summary>
    /// Fail-safe N. Rosenthal: N = k*((meanZ/sqrt(2pi))/ln2 ... ) classic form
    ///   N_fs = sum(z_i^2) / z_crit^2 * k ... implemented as:
    ///   N_rosenthal = 3.3*k*(sum z/ (k)) ... canonical: k*(k*meanZ^2 - 1.6449^2)/1.6449^2
    /// Orwin: N to bring mean effect down to a trivial target.
    /// </summary>
    internal static List<FailsafeResult> FailSafeN(List<double> effs, List<double> ses)
    {
        var list = new List<FailsafeResult>();
        int k = effs.Count;

        // Rosenthal (1979): how many null studies needed to push pooled p above .05?
        double sumZ = 0;
        for (int i = 0; i < k; i++)
            sumZ += effs[i] / ses[i];
        double zCrit = 1.644854; // one-sided 5%
        double nRos = Math.Max(0, Math.Ceiling(k * (Math.Pow(sumZ / k, 2) * k - Math.Pow(zCrit, 2)) / Math.Pow(zCrit, 2)));
        list.Add(new FailsafeResult
        {
            method = "rosenthal",
            n_required = nRos,
            note = "Studies needed to nullify significance at alpha=.05 (one-sided)",
        });

        // Orwin (1983): studies needed to bring standardized mean effect down to d_trivial (=0.1)
        double meanStdEff = effs.Zip(ses, (e, s) => e).Average(); // unstandardized mean
        double target = 0.1;
        if (Math.Abs(meanStdEff) > target)
        {
            double nOrwin = Math.Max(0, Math.Ceiling(k * (meanStdEff - target) / target));
            list.Add(new FailsafeResult
            {
                method = "orwin",
                n_required = nOrwin,
                target = target,
                note = $"Studies with zero effect needed to drop the mean effect to {target}",
            });
        }
        return list;
    }
}

/// <summary>Small regression helpers shared by the bias suite.</summary>
public static class Regression
{
    public static (double slope, double intercept, double seInt, double z, double p) OlsIntercept(
        List<double> x, List<double> y)
    {
        int n = x.Count;
        double mx = x.Average(), my = y.Average();
        double sxx = x.Sum(v => (v - mx) * (v - mx));
        double sxy = x.Zip(y, (a, b) => (a - mx) * (b - my)).Sum();
        double slope = sxx == 0 ? 0 : sxy / sxx;
        double intercept = my - slope * mx;
        double ssRes = y.Zip(x, (yi, xi) => yi - (slope * xi + intercept)).Sum(d => d * d);
        double mse = ssRes / Math.Max(n - 2, 1);
        double seInt = Math.Sqrt(Math.Max(mse * (1.0 / n + mx * mx / Math.Max(sxx, 1e-12)), 1e-12));
        double z = intercept / seInt;
        double p = 2 * (1 - Stats.NormalCdf(Math.Abs(z)));
        return (slope, intercept, seInt, z, p);
    }

    public static (double slope, double intercept, double seInt, double z, double p) WlsIntercept(
        List<double> x, List<double> y, List<double> w)
    {
        int n = x.Count;
        double sw = w.Sum(),
               swx = w.Zip(x, (wi, xi) => wi * xi).Sum(),
               swy = w.Zip(y, (wi, yi) => wi * yi).Sum(),
               swxx = w.Zip(x, (wi, xi) => wi * xi * xi).Sum(),
               swxy = w.Select((wi, i) => wi * x[i] * y[i]).Sum();
        double denom = sw * swxx - swx * swx;
        double slope = denom == 0 ? 0 : (sw * swxy - swx * swy) / denom;
        double intercept = (swy - slope * swx) / sw;
        // robust-ish model-based variance: residual scale x weighted leverage of intercept
        double ssRes = y.Zip(x, (yi, xi) => yi - (slope * xi + intercept))
                        .Zip(w, (r, wi) => wi * r * r).Sum();
        double dof = Math.Max(n - 2, 1);
        double sigma2 = ssRes / dof;
        double xbarW = swx / sw;
        double sxxW = Math.Max(swxx - sw * xbarW * xbarW, 1e-12);
        double seInt = Math.Sqrt(Math.Max(sigma2 * (1.0 / sw + xbarW * xbarW / sxxW), 1e-12));
        double z = intercept / seInt;
        double p = 2 * (1 - Stats.NormalCdf(Math.Abs(z)));
        return (slope, intercept, seInt, z, p);
    }
}
