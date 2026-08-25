using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Mantel-Haenszel and Peto one-step poolers (RevMan defaults for binary data).
/// Formulas transcribed EXACTLY from metafor sources (R/rma.mh.r, R/rma.peto.r):
///
/// MH (Robins-Breslow-Greenland 1986 variance):
///   Pi = ai/N + di/N ; Qi = bi/N + ci/N ; Ri = (ai/N)*di ; Si = (bi/N)*ci
///   R = sum(Ri), S = sum(Si), lnOR = log(R/S)
///   SE = sqrt( 1/2 * ( sum(Pi*Ri)/R^2 + sum(Pi*Si + Qi*Ri)/(R*S) + sum(Qi*Si)/S^2 ) )
///   Defaults mirrored: add=1/2 to="only0" (studies with >=1 zero cell get +0.5),
///   drop00=TRUE (double-zero / all-events studies dropped).
///
/// Peto (Yusuf et al.):
///   Ei = xT * n1/N ; Vi = xT*yT*(n1/N)*(n2/N)/(N-1)   [xT=a+c, yT=b+d]
///   beta = sum(ai - Ei)/sum(Vi), SE = sqrt(1/sum(Vi))
///   QE = max(0, sum((ai-Ei)^2/Vi) - (sum(ai-Ei))^2/sum(Vi))
/// </summary>
public static class SpecialPoolers
{
    internal sealed class Cells { public double A, B, Cc, D; public Study S = null!; }

    /// <summary>Extract valid 2x2 tables applying metafor's default drop00 + add/to rules.</summary>
    private static List<Cells> ValidCells(List<MaWork> works, bool correct)
    {
        var list = new List<Cells>();
        foreach (var w in works)
        {
            if (w.S.int_events == null || w.S.int_n == null || w.S.ctrl_events == null || w.S.ctrl_n == null)
                continue;
            double a = w.S.int_events.Value, b = w.S.int_n.Value - w.S.int_events.Value;
            double c = w.S.ctrl_events.Value, d = w.S.ctrl_n.Value - w.S.ctrl_events.Value;
            if (a < 0 || b < 0 || c < 0 || d < 0) continue;
            // drop00: no events in both arms, or events in every subject of both arms
            if ((a == 0 && c == 0) || (b == 0 && d == 0)) continue;
            bool zero = (a == 0 || b == 0 || c == 0 || d == 0);
            if (correct && zero) { a += 0.5; b += 0.5; c += 0.5; d += 0.5; }
            list.Add(new Cells { A = a, B = b, Cc = c, D = d, S = w.S });
        }
        return list;
    }

    public static CoreResult MantelHaenszelOR(List<MaWork> works)
    {
        var cells = ValidCells(works, correct: true);
        int k = cells.Count;
        if (k == 0) throw new ArgumentException("No valid binary studies for Mantel-Haenszel");

        double R = 0, S = 0, prSum = 0, psPlusQrSum = 0, qsSum = 0;
        foreach (var t in cells)
        {
            double a = t.A, b = t.B, c = t.Cc, d = t.D, N = a + b + c + d;
            double Pi = a / N + d / N;
            double Qi = b / N + c / N;
            double Ri = (a / N) * d;
            double Si = (b / N) * c;
            R += Ri; S += Si;
            prSum += Pi * Ri;
            psPlusQrSum += Pi * Si + Qi * Ri;
            qsSum += Qi * Si;
        }
        if (R <= 0 || S <= 0)
            throw new ArgumentException("Mantel-Haenszel undefined: R or S is zero across all studies");
        double lnOR = Math.Log(R / S);
        double se = Math.Sqrt(0.5 * (prSum / (R * R) + psPlusQrSum / (R * S) + qsSum / (S * S)));

        // Heterogeneity: inverse-variance (Woolf) weighted Q around the pooled estimate,
        // computed on per-study corrected log-ORs (display-level diagnostic).
        double q = 0; var wl = new List<double>();
        foreach (var t in cells)
        {
            double a = t.A, b = t.B, c = t.Cc, d = t.D;
            double vI = 1 / a + 1 / b + 1 / c + 1 / d;
            double lorI = Math.Log((a * d) / (b * c));
            double wI = 1 / vI;
            wl.Add(wI);
            q += wI * Math.Pow(lorI - lnOR, 2);
        }
        int df = Math.Max(k - 1, 0);
        double qp = df > 0 ? 1 - Chi2.Cdf(q, df) : 1;
        double i2 = (q > df && q > 0) ? Math.Max(0, (q - df) / q * 100) : 0;

        return new CoreResult
        {
            FeEff = lnOR, FeSe = se,
            ReEff = lnOR, ReSe = se,   // MH is an equal-effects estimator; no tau2
            Tau2 = 0, Q = q, Df = df, Qp = qp, I2 = i2,
            IsSpecialPooler = true,
            Note = "Mantel-Haenszel equal-effects OR; Robins-Breslow-Greenland SE",
            StudyWeights = wl, TotalWeight = wl.Sum(),
        };
    }

    public static CoreResult PetoOddsRatio(List<MaWork> works)
    {
        // Peto uses RAW cells (no continuity correction); zero-variance tables skipped
        var oe = new List<double>(); var vi = new List<double>(); var labels = new List<string?>();
        foreach (var w in works)
        {
            var s = w.S;
            if (s.int_events == null || s.int_n == null || s.ctrl_events == null || s.ctrl_n == null) continue;
            double a = s.int_events.Value, n1 = s.int_n.Value;
            double c = s.ctrl_events.Value, n2 = s.ctrl_n.Value;
            if (a < 0 || c < 0 || n1 <= 0 || n2 <= 0) continue;
            if ((a == 0 && c == 0) || ((n1 - a) == 0 && (n2 - c) == 0)) continue; // drop00
            double N = n1 + n2, xT = a + c, yT = N - xT;
            if (xT == 0 || yT == 0) continue;
            double E = xT * n1 / N;
            double V = xT * yT * (n1 / N) * (n2 / N) / Math.Max(N - 1, 1);
            if (V <= 0) continue;
            oe.Add(a - E); vi.Add(V); labels.Add(s.study);
        }
        int k = vi.Count;
        if (k == 0) throw new ArgumentException("Peto: no informative studies");
        double sumV = vi.Sum();
        double beta = oe.Sum() / sumV;
        double se = Math.Sqrt(1 / sumV);

        double oSum = oe.Sum();
        double sqSum = oe.Zip(vi, (o, v) => o * o / v).Sum();
        double q = Math.Max(0, sqSum - oSum * oSum / sumV);   // metafor QE form
        int df = Math.Max(k - 1, 0);
        double qp = df > 0 ? 1 - Chi2.Cdf(q, df) : 1;
        double i2 = (q > df && q > 0) ? Math.Max(0, (q - df) / q * 100) : 0;

        return new CoreResult
        {
            FeEff = beta, FeSe = se,
            ReEff = beta, ReSe = se,
            Tau2 = 0, Q = q, Df = df, Qp = qp, I2 = i2,
            IsSpecialPooler = true,
            Note = "Peto one-step OR (Yusuf O-E/V); robust to rare events",
            StudyWeights = vi, TotalWeight = sumV,
        };
    }
}
