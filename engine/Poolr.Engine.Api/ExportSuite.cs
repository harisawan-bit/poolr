using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;

namespace Poolr.Engine.Api;

/// <summary>
/// v0.5.1 export suite: R/metafor replication code, BibTeX/RIS citation export,
/// methods-section paragraph generator. Pure string builders, no deps.
/// </summary>
public static class ExportSuite
{
    private static string F(double v, string fmt = "0.0000") => v.ToString(fmt, CultureInfo.InvariantCulture);

    // ---------------- R / metafor replication --------------------------------

    public static string RReplication(ExtendedMetaResponse r, List<Study> data)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# poolr v0.5.7 replication script — run with library(metafor)");
        sb.AppendLine("# Regenerates every analysis shown in the app from the raw data.");
        var measureMap = new Dictionary<string, string>
        {
            ["OR"] = "\"OR\"",
            ["RR"] = "\"RR\"",
            ["RD"] = "\"RD\"",
            ["MH_OR"] = "\"OR\"",
            ["PETO"] = "\"OR\"",
            ["MD"] = "\"MD\"",
            ["SMD"] = "\"SMD\"",
            ["GLASS"] = "\"SMD\"",
            ["HR"] = "\"HR\"",
            ["LOGIT_PROP"] = "\"PLO\"",
            ["ARS_PROP"] = "\"PAS\"",
            ["IRR"] = "\"IRR\"",
            ["IRD"] = "\"IRD\"",
            ["Z_CORR"] = "\"ZCOR\"",
            ["GEN_IV"] = "\"GEN\"",
        };
        string method = r.method switch
        {
            "MH (Robins-Breslow-Greenland)" => "MH",
            "Peto O-E" => "PETO",
            _ => r.method,
        };
        bool isSpecial = r.measure is "MH_OR" or "PETO";
        bool isProp = r.measure is "LOGIT_PROP" or "ARS_PROP";
        bool isCorr = r.measure == "Z_CORR";
        bool isGen = r.measure == "GEN_IV";

        sb.AppendLine("library(metafor)");
        sb.AppendLine();
        if (isGen)
        {
            sb.AppendLine("dat <- data.frame(");
            sb.AppendLine("  study = c(" + string.Join(", ", data.Select(s => Q(s.study))) + "),");
            sb.AppendLine("  yi = c(" + string.Join(", ", data.Select(s => F(s.effect_size ?? 0))) + "),");
            sb.AppendLine("  vi = c(" + string.Join(", ", data.Select(s => F(Math.Pow(s.effect_se ?? 1e-9, 2)))) + "))");
            sb.AppendLine("res <- rma(yi, vi, data=dat, method=\"" + RMethod(r) + "\", test=\"" + (r.knapp_hartung ? "knha" : "z") + "\")");
            sb.AppendLine("summary(res)");
        }
        else if (isCorr || isProp)
        {
            if (isCorr)
            {
                sb.AppendLine("dat <- escalc(measure=\"ZCOR\", ri=c(" +
                    string.Join(", ", data.Select(s => F(s.correlation ?? 0))) + "), ni=c(" +
                    string.Join(", ", data.Select(s => (s.n_total ?? 0).ToString(CultureInfo.InvariantCulture))) + "))");
            }
            else
            {
                sb.AppendLine("dat <- escalc(measure=" + (r.measure == "LOGIT_PROP" ? "\"PLO\"" : "\"PAS\"") +
                              ", xi=c(" + string.Join(", ", data.Select(s => (s.int_events ?? 0).ToString(CultureInfo.InvariantCulture))) +
                              "), ni=c(" + string.Join(", ", data.Select(s => (s.int_n ?? 0).ToString(CultureInfo.InvariantCulture))) + "))");
            }
            sb.AppendLine("res <- rma(yi, vi, data=dat, method=\"" + RMethod(r) + "\", test=\"" + (r.knapp_hartung ? "knha" : "z") + "\")");
            sb.AppendLine("summary(res)");
        }
        else
        {
            sb.AppendLine("# 2x2 / continuous / survival data");
            sb.AppendLine("dat <- data.frame(");
            if (!isSpecial && data.All(s => s.type != "survival") &&
                data.Any(s => s.int_mean != null))
            {
                sb.AppendLine("  m1i=c(" + J(data, s => s.int_mean) + "), sd1i=c(" + J(data, s => s.int_sd) + "), n1i=c(" + J(data, s => s.int_n) + "),");
                sb.AppendLine("  m2i=c(" + J(data, s => s.ctrl_mean) + "), sd2i=c(" + J(data, s => s.ctrl_sd) + "), n2i=c(" + J(data, s => s.ctrl_n) + "))");
                sb.AppendLine("dat <- escalc(measure=" + (r.measure == "SMD" || r.measure == "GLASS" ? "\"SMD\"" : "\"MD\"") + ", m1i=m1i, sd1i=sd1i, n1i=n1i, m2i=m2i, sd2i=sd2i, n2i=n2i)");
                sb.AppendLine("res <- rma(yi, vi, data=dat, method=\"" + RMethod(r) + "\", test=\"" + (r.knapp_hartung ? "knha" : "z") + "\")");
            }
            else if (data.Any(s => s.hr != null))
            {
                sb.AppendLine("  yi=log(c(" + string.Join(",", data.Select(s => F(s.hr ?? 1))) + ")),");
                sb.AppendLine("  vi=((log(c(" + string.Join(",", data.Select(s => F(s.hr_upper ?? 1))) + "))-log(c(" +
                             string.Join(",", data.Select(s => F(s.hr_lower ?? 1))) + ")))/(2*1.959964))^2)");
                sb.AppendLine("res <- rma(yi, vi, method=\"" + RMethod(r) + "\", test=\"" + (r.knapp_hartung ? "knha" : "z") + "\")");
            }
            else
            {
                // binary: emit all four cells directly (int_n - events = non-events)
                sb.AppendLine("  ai=c(" + J(data, s => s.int_events) + "), bi=c(" +
                              JExpr(data, s => (s.int_n ?? 0) - (s.int_events ?? 0)) + "), ci=c(" + J(data, s => s.ctrl_events) + "), di=c(" +
                              JExpr(data, s => (s.ctrl_n ?? 0) - (s.ctrl_events ?? 0)) + "))");
                sb.AppendLine("# poolr note: rma.mh/rma.peto take the cells directly; escalc computes yi/vi first");
                sb.AppendLine("res <- " + (isSpecial && r.measure == "MH_OR"
                    ? "rma.mh(measure=\"OR\", ai=ai, bi=bi, ci=ci, di=di)"
                    : isSpecial && r.measure == "PETO" ? "rma.peto(ai=ai, bi=bi, ci=ci, di=di)"
                    : "escalc(measure=" + measureMap.GetValueOrDefault(r.measure, "OR") + ", ai=ai, bi=bi, ci=ci, di=di); res <- rma(yi, vi)"));
            }
        }
        sb.AppendLine();
        sb.AppendLine("# Figures");
        sb.AppendLine("forest(res); funnel(res); radial(res); labbe(res); baujat(res)");
        sb.AppendLine("regtest(res); ranktest(res)");
        if (r.heterogeneity.i2 > 25)
            sb.AppendLine("trimfill(res); trimfill(res)$k0   # asymmetry indicated by Egger/p-curve checks");
        return sb.ToString();
    }

    private static string RMethod(ExtendedMetaResponse r) =>
        r.method switch { "REML" => "REML", "PM" => "PM", "HS" => "HS", "ML" => "ML", "EB" => "EB", _ => "DL" };

    private static string J(List<Study> data, Func<Study, double?> f) =>
        string.Join(", ", data.Select(s => (f(s) ?? double.NaN).ToString(CultureInfo.InvariantCulture)));

    private static string JExpr(List<Study> data, Func<Study, int> f) =>
        string.Join(", ", data.Select(s => f(s).ToString(CultureInfo.InvariantCulture)));

    private static string Q(string? s) => "\"" + (s ?? "").Replace("\"", "\\\"") + "\"";

    // ---------------- citations -------------------------------------------------

    public static string BibTeX(IEnumerable<Study> studies)
    {
        var sb = new StringBuilder();
        int i = 1;
        foreach (var s in studies)
        {
            string key = (s.study ?? $"study{i}").Replace(" ", "").Replace(",", "");
            sb.AppendLine($"@misc{{{key},");
            sb.AppendLine($"  title = {{{s.study}}},");
            if (s.year.HasValue) sb.AppendLine($"  year = {{{s.year.Value}}}");
            sb.AppendLine("}");
            i++;
        }
        return sb.ToString();
    }

    public static string RisExport(IEnumerable<Study> studies)
    {
        var sb = new StringBuilder();
        foreach (var s in studies)
        {
            sb.AppendLine("TY  - JOUR");
            sb.AppendLine($"TI  - {s.study}");
            if (s.year.HasValue) sb.AppendLine($"PY  - {s.year.Value}");
            sb.AppendLine("ER  - ");
        }
        return sb.ToString();
    }

    // ---------------- methods paragraph ------------------------------------------

    public static string MethodsParagraph(ExtendedMetaResponse r)
    {
        var sb = new StringBuilder();
        bool random = r.model.Contains("Random");
        sb.Append($"Meta-analytic pooling was performed for {r.k} studies using the ");
        if (random) sb.Append($"random-effects model with heterogeneity variance estimated by the {MethodLong(r.method)} method");
        else sb.Append("common-effect model");
        if (r.knapp_hartung) sb.Append("; confidence intervals employed the Knapp-Hartung adjustment (t-distribution on k-1 degrees of freedom)");
        sb.Append(". ");
        if (r.publication_bias?.egger != null)
            sb.Append($"Small-study effects were examined with Egger's regression test (intercept {F(r.publication_bias.egger.intercept, "0.00")}, p = {F(r.publication_bias.egger.p_value, "0.000")}) ");
        if (r.publication_bias?.trimfill != null)
            sb.Append($"and the Duval-Tweedie trim-and-fill procedure ({r.publication_bias.trimfill.n_imputed} imputed study/studies). ");
        sb.Append($"Heterogeneity was quantified with Cochran's Q (Q = {F(r.heterogeneity.q, "0.0")}, df = {r.heterogeneity.df}, p = {F(r.heterogeneity.q_p, "0.000")}), I-squared = {F(r.heterogeneity.i2, "0.0")}%, and tau-squared = {F(r.heterogeneity.tau2, "0.000")}. ");
        if (r.subgroups?.between != null)
            sb.Append($"Subgroup differences were tested with the Q-between statistic ({F(r.subgroups.between.q, "0.0")}, df = {r.subgroups.between.df}, p = {F(r.subgroups.between.p, "0.000")}). ");
        sb.Append("Analyses were conducted in poolr v0.5.7; an R/metafor replication script accompanies this report.");
        return sb.ToString();
    }

    private static string MethodLong(string m) => m switch
    {
        "DL" => "DerSimonian-Laird",
        "REML" => "restricted maximum-likelihood",
        "PM" => "Paule-Mandel",
        "HS" => "Hunter-Schmidt",
        "ML" => "maximum likelihood",
        "EB" => "empirical Bayes",
        _ => m,
    };
}
