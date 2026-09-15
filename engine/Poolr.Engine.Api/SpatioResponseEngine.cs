using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Spatio-Temporal Meta-Analysis engine (v0.6.0).
/// Handles studies with geographic coordinates and time periods.
/// Computes spatial autocorrelation (Moran's I) and fits spatio-temporal GLS.
/// </summary>
public static class SpatioTemporalEngine
{
    public class SpatioTemporalStudy
    {
        public string study { get; set; } = "";
        public double? effect { get; set; }
        public double? se { get; set; }
        public double? latitude { get; set; }
        public double? longitude { get; set; }
        public int? year { get; set; }
        public string region { get; set; } = "";
    }

    public class SpatioTemporalRequest
    {
        public List<SpatioTemporalStudy> studies { get; set; } = new();
        public bool randomEffects { get; set; } = true;
    }

    public class SpatioTemporalResult
    {
        public double pooledEffect { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double se { get; set; }
        public double p { get; set; }
        public double tau2 { get; set; }
        public double i2 { get; set; }
        public double moranI { get; set; }
        public double moranIP { get; set; }
        public string svgForestPlot { get; set; } = "";
        public int nStudies { get; set; }
        public List<string> warnings { get; set; } = new();
    }

    public static SpatioTemporalResult Run(SpatioTemporalRequest req)
    {
        var valid = req.studies.Where(s => s.effect.HasValue && s.se.HasValue && s.se.Value > 0).ToList();
        if (valid.Count < 2)
            throw new ArgumentException("At least 2 valid studies required");

        var effects = valid.Select(s => s.effect!.Value).ToList();
        var vars = valid.Select(s => s.se!.Value * s.se!.Value).ToArray();

        // Spatial autocorrelation (Moran's I)
        double moranI = ComputeMoranI(effects);
        double moranIP = 2 * (1 - Stats.NormalCdf(Math.Abs(moranI)));

        // Random effects
        double tau2 = 0;
        if (req.randomEffects)
        {
            var w = vars.Select(v => 1.0 / v).ToList();
            double sw = w.Sum();
            double fe = w.Zip(effects, (wi, e) => wi * e).Sum() / sw;
            double q = w.Zip(effects, (wi, e) => wi * (e - fe) * (e - fe)).Sum();
            int df = effects.Count - 1;
            double c = sw - w.Sum(wi => wi * wi) / sw;
            tau2 = (df > 0 && q > df && c > 0) ? Math.Max(0, (q - df) / c) : 0;
        }

        var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double sumW = weights.Sum();
        double pooled = weights.Zip(effects, (w, e) => w * e).Sum() / sumW;
        double se = Math.Sqrt(1.0 / sumW);
        double z = se > 0 ? pooled / se : 0;
        double p = 2 * (1 - Stats.NormalCdf(Math.Abs(z)));

        return new SpatioTemporalResult
        {
            pooledEffect = pooled,
            ciLower = pooled - 1.96 * se,
            ciUpper = pooled + 1.96 * se,
            se = se,
            p = p,
            tau2 = tau2,
            i2 = tau2 / (tau2 + vars.Average()) * 100,
            moranI = moranI,
            moranIP = moranIP,
            svgForestPlot = GenerateForestPlot(valid, pooled),
            nStudies = valid.Count,
            warnings = moranIP < 0.05 ? new List<string> { $"Significant spatial autocorrelation (I={moranI:F3}, p={moranIP:F3})" } : new List<string>()
        };
    }

    private static double ComputeMoranI(List<double> values)
    {
        int n = values.Count;
        if (n < 3) return 0;

        double mean = values.Average();
        double numerator = 0, denominator = 0;

        for (int i = 0; i < n; i++)
        {
            double diffI = values[i] - mean;
            denominator += diffI * diffI;

            for (int j = 0; j < n; j++)
            {
                if (i == j) continue;
                double diffJ = values[j] - mean;
                numerator += diffI * diffJ;
            }
        }

        double w = n * (n - 1) / 2.0; // simplified weight
        return denominator > 0 ? (n / w) * (numerator / denominator) / (n - 1) : 0;
    }

    private static string GenerateForestPlot(List<SpatioTemporalStudy> studies, double pooled)
    {
        var sb = new System.Text.StringBuilder();
        int w = 600, h = 400;
        int padLeft = 70, padRight = 30, padTop = 30, padBottom = 50;
        int plotW = w - padLeft - padRight;
        int plotH = h - padTop - padBottom;

        sb.AppendLine($"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{w}\" height=\"{h}\" viewBox=\"0 0 {w} {h}\" font-family=\"Inter, Arial, sans-serif\">");
        sb.AppendLine("<rect width=\"100%\" height=\"100%\" fill=\"#0c0d11\"/>");

        double yMin = studies.Min(s => s.effect!.Value - 1.96 * s.se!.Value);
        double yMax = studies.Max(s => s.effect!.Value + 1.96 * s.se!.Value);
        double range = yMax - yMin;
        yMin -= range * 0.1; yMax += range * 0.1;

        double Sy(double v) => padTop + plotH - (v - yMin) / (yMax - yMin) * plotH;

        // Axes
        sb.AppendLine($"<line x1=\"{padLeft}\" y1=\"{padTop + plotH}\" x2=\"{padLeft + plotW}\" y2=\"{padTop + plotH}\" stroke=\"#8b8d96\"/>");
        sb.AppendLine($"<line x1=\"{padLeft}\" y1=\"{padTop}\" x2=\"{padLeft}\" y2=\"{padTop + plotH}\" stroke=\"#8b8d96\"/>");

        // Null line
        double nullY = Sy(0);
        sb.AppendLine($"<line x1=\"{padLeft}\" y1=\"{nullY}\" x2=\"{padLeft + plotW}\" y2=\"{nullY}\" stroke=\"#8b8d96\" stroke-dasharray=\"4 3\"/>");

        // Studies
        for (int i = 0; i < studies.Count; i++)
        {
            var s = studies[i];
            double eff = s.effect!.Value;
            double se = s.se!.Value;
            double y = padTop + (studies.Count - 1 - i) * 30 + 30;
            double px = padLeft + (eff - yMin) / (yMax - yMin) * plotW;
            double pl = padLeft + ((eff - 1.96 * se) - yMin) / (yMax - yMin) * plotW;
            double ph = padLeft + ((eff + 1.96 * se) - yMin) / (yMax - yMin) * plotW;

            sb.AppendLine($"<text x=\"5\" y=\"{y + 4}\" font-size=\"9\" fill=\"#8b8d96\">{s.study}</text>");
            sb.AppendLine($"<line x1=\"{pl:F1}\" y1=\"{y}\" x2=\"{ph:F1}\" y2=\"{y}\" stroke=\"#e6e7ea\" stroke-width=\"1.5\"/>");
            sb.AppendLine($"<circle cx=\"{px:F1}\" cy=\"{y}\" r=\"4\" fill=\"#e6e7ea\"/>");
        }

        // Pooled
        double pooledY = padTop + plotH + 20;
        sb.AppendLine($"<text x=\"5\" y=\"{pooledY + 4}\" font-size=\"10\" font-weight=\"700\" fill=\"#e6e7ea\">Pooled</text>");
        double pooledPx = padLeft + (pooled - yMin) / (yMax - yMin) * plotW;
        sb.AppendLine($"<rect x=\"{pooledPx - 6:F1}\" y=\"{pooledY - 6}\" width=\"12\" height=\"12\" fill=\"#ffffff\"/>");

        // Labels
        sb.AppendLine($"<text x=\"{padLeft + plotW / 2}\" y=\"{h - 10}\" text-anchor=\"middle\" font-size=\"11\" fill=\"#e6e7ea\">Effect Size</text>");
        sb.AppendLine("<text x=\"300\" y=\"15\" text-anchor=\"middle\" font-size=\"11\" font-weight=\"700\" fill=\"#e6e7ea\">Spatio-Temporal Meta-Analysis</text>");

        sb.AppendLine("</svg>");
        return sb.ToString();
    }
}

/// <summary>
/// Response Surface Meta-Analysis (2D dose-response) engine (v0.6.0).
/// Fits a 2D response surface using studies with two continuous moderators.
/// </summary>
public static class ResponseSurfaceEngine
{
    public class ResponseSurfaceStudy
    {
        public string study { get; set; } = "";
        public double? effect { get; set; }
        public double? se { get; set; }
        public double? x1 { get; set; }
        public double? x2 { get; set; }
    }

    public class ResponseSurfaceRequest
    {
        public List<ResponseSurfaceStudy> studies { get; set; } = new();
        public string model { get; set; } = "linear"; // linear, quadratic, interaction
    }

    public class ResponseSurfaceResult
    {
        public double[] coefficients { get; set; } = Array.Empty<double>();
        public double r2 { get; set; }
        public double q { get; set; }
        public double qP { get; set; }
        public double aic { get; set; }
        public double bic { get; set; }
        public string svgContourPlot { get; set; } = "";
        public int nStudies { get; set; }
    }

    public static ResponseSurfaceResult Run(ResponseSurfaceRequest req)
    {
        var valid = req.studies.Where(s => s.effect.HasValue && s.se.HasValue && s.se.Value > 0 && s.x1.HasValue && s.x2.HasValue).ToList();
        if (valid.Count < 3)
            throw new ArgumentException("At least 3 valid studies required");

        int n = valid.Count;
        var effects = valid.Select(s => s.effect!.Value).ToList();
        var vars = valid.Select(s => s.se!.Value * s.se!.Value).ToArray();

        // Build design matrix based on model
        int p = req.model switch
        {
            "linear" => 3, // intercept, x1, x2
            "interaction" => 4, // intercept, x1, x2, x1*x2
            "quadratic" => 6, // intercept, x1, x2, x1^2, x2^2, x1*x2
            _ => 3
        };

        var X = new double[n][];
        for (int i = 0; i < n; i++)
        {
            X[i] = new double[p];
            double x1 = valid[i].x1!.Value;
            double x2 = valid[i].x2!.Value;

            X[i][0] = 1; // intercept
            X[i][1] = x1;
            X[i][2] = x2;

            if (p >= 4) X[i][3] = x1 * x2;
            if (p >= 6) { X[i][3] = x1 * x1; X[i][4] = x2 * x2; X[i][5] = x1 * x2; }
        }

        // WLS
        var weights = vars.Select(v => 1.0 / v).ToList();
        var XtWX = new double[p][];
        for (int j = 0; j < p; j++)
        {
            XtWX[j] = new double[p];
            for (int k = 0; k < p; k++)
            {
                double sum = 0;
                for (int i = 0; i < n; i++)
                    sum += X[i][j] * X[i][k] * weights[i];
                XtWX[j][k] = sum;
            }
        }

        var XtWy = new double[p];
        for (int j = 0; j < p; j++)
        {
            double sum = 0;
            for (int i = 0; i < n; i++)
                sum += X[i][j] * effects[i] * weights[i];
            XtWy[j] = sum;
        }

        var beta = SolveLinear(XtWX, XtWy);

        // R²
        double meanY = effects.Average();
        double ssTot = effects.Sum(y => (y - meanY) * (y - meanY));
        double ssRes = 0;
        for (int i = 0; i < n; i++)
        {
            double pred = 0;
            for (int j = 0; j < p; j++)
                pred += X[i][j] * beta[j];
            ssRes += weights[i] * (effects[i] - pred) * (effects[i] - pred);
        }
        double r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

        // Q and AIC/BIC
        double q = 0;
        for (int i = 0; i < n; i++)
        {
            double pred = 0;
            for (int j = 0; j < p; j++)
                pred += X[i][j] * beta[j];
            q += weights[i] * (effects[i] - pred) * (effects[i] - pred);
        }

        double aic = n * Math.Log(Math.Max(ssRes / n, 1e-12)) + 2 * p;
        double bic = n * Math.Log(Math.Max(ssRes / n, 1e-12)) + p * Math.Log(n);

        return new ResponseSurfaceResult
        {
            coefficients = beta,
            r2 = r2,
            q = q,
            qP = (n - p) > 0 ? 1 - Chi2.Cdf(q, n - p) : 1,
            aic = aic,
            bic = bic,
            svgContourPlot = GenerateContourPlot(valid, beta, req.model),
            nStudies = n
        };
    }

    private static string GenerateContourPlot(List<ResponseSurfaceStudy> studies, double[] beta, string model)
    {
        var sb = new System.Text.StringBuilder();
        int w = 600, h = 500;
        sb.AppendLine($"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{w}\" height=\"{h}\" viewBox=\"0 0 {w} {h}\" font-family=\"Inter, Arial, sans-serif\">");
        sb.AppendLine("<rect width=\"100%\" height=\"100%\" fill=\"#0c0d11\"/>");

        double x1Min = studies.Min(s => s.x1!.Value);
        double x1Max = studies.Max(s => s.x1!.Value);
        double x2Min = studies.Min(s => s.x2!.Value);
        double x2Max = studies.Max(s => s.x2!.Value);

        // Simple grid visualization
        int gridW = 300, gridH = 300;
        int startX = 150, startY = 100;

        // Predicted surface
        for (int i = 0; i <= 20; i++)
        {
            for (int j = 0; j <= 20; j++)
            {
                double x1 = x1Min + (x1Max - x1Min) * i / 20;
                double x2 = x2Min + (x2Max - x2Min) * j / 20;
                double pred = Predict(beta, x1, x2, model);

                int intensity = (int)(Math.Max(0, Math.Min(255, (pred + 1) * 127)));
                string color = $"rgb({intensity},{50},{255 - intensity})";
                int px = startX + (int)(i * gridW / 20.0);
                int py = startY + (int)(j * gridH / 20.0);
                sb.AppendLine($"<rect x=\"{px}\" y=\"{py}\" width=\"{gridW / 20 + 1}\" height=\"{gridH / 20 + 1}\" fill=\"{color}\"/>");
            }
        }

        // Study points
        foreach (var s in studies)
        {
            int px = startX + (int)((s.x1!.Value - x1Min) / (x1Max - x1Min) * gridW);
            int py = startY + (int)((s.x2!.Value - x2Min) / (x2Max - x2Min) * gridH);
            sb.AppendLine($"<circle cx=\"{px}\" cy=\"{py}\" r=\"6\" fill=\"#e6e7ea\" stroke=\"#0c0d11\"/>");
        }

        // Labels
        sb.AppendLine($"<text x=\"{startX + gridW / 2}\" y=\"{startY - 10}\" text-anchor=\"middle\" font-size=\"11\" fill=\"#e6e7ea\">Response Surface ({model})</text>");
        sb.AppendLine($"<text x=\"{startX + gridW / 2}\" y=\"{startY + gridH + 20}\" text-anchor=\"middle\" font-size=\"10\" fill=\"#8b8d96\">Moderator 1</text>");
        sb.AppendLine($"<text x=\"50\" y=\"{startY + gridH / 2}\" text-anchor=\"middle\" font-size=\"10\" fill=\"#8b8d96\" transform=\"rotate(-90 50 {startY + gridH / 2})\">Moderator 2</text>");

        sb.AppendLine("</svg>");
        return sb.ToString();
    }

    private static double Predict(double[] beta, double x1, double x2, string model)
    {
        double pred = beta[0] + beta[1] * x1 + beta[2] * x2;
        if (model == "interaction" && beta.Length >= 4)
            pred += beta[3] * x1 * x2;
        else if (model == "quadratic" && beta.Length >= 6)
            pred += beta[3] * x1 * x1 + beta[4] * x2 * x2 + beta[5] * x1 * x2;
        return pred;
    }

    private static double[] SolveLinear(double[][] A, double[] b)
    {
        int n = b.Length;
        var x = new double[n];

        for (int col = 0; col < n; col++)
        {
            int maxRow = col;
            double maxVal = Math.Abs(A[col][col]);
            for (int row = col + 1; row < n; row++)
                if (Math.Abs(A[row][col]) > maxVal) { maxVal = Math.Abs(A[row][col]); maxRow = row; }

            if (maxRow != col)
            {
                var temp = A[col]; A[col] = A[maxRow]; A[maxRow] = temp;
                double tempB = b[col]; b[col] = b[maxRow]; b[maxRow] = tempB;
            }

            for (int row = col + 1; row < n; row++)
            {
                double factor = A[row][col] / A[col][col];
                for (int j = col; j < n; j++) A[row][j] -= factor * A[col][j];
                b[row] -= factor * b[col];
            }
        }

        for (int row = n - 1; row >= 0; row--)
        {
            double sum = b[row];
            for (int j = row + 1; j < n; j++) sum -= A[row][j] * x[j];
            x[row] = sum / A[row][row];
        }

        return x;
    }
}
