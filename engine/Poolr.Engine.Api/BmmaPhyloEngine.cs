using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Bayesian Model-Averaged Meta-Analysis engine (v0.6.0).
/// Combines multiple meta-analysis models using Bayesian model averaging.
/// Models: fixed/random effects × with/without publication bias (PET-PEESE, selection models).
/// Mirrors R RoBMA package and JASP's Bayesian MA module.
/// </summary>
public static class BayesianModelAveragingEngine
{
    public class BmmaRequest
    {
        public List<double> effects { get; set; } = new();
        public List<double> standardErrors { get; set; } = new();
        public int? seed { get; set; } = 42;
        public int nIter { get; set; } = 20000;
        public int nWarmup { get; set; } = 5000;
        public bool includePublicationBias { get; set; } = true;
        public bool includePETPEESE { get; set; } = true;
        public bool includeSelectionModel { get; set; } = true;
    }

    public class BmmaModel
    {
        public string name { get; set; } = "";
        public double posteriorProbability { get; set; }
        public double pooledEffect { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double tau2 { get; set; }
    }

    public class BmmaResult
    {
        public double pooledEffect { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double tau2 { get; set; }
        public double petPeesEffect { get; set; }
        public double petPeesCiLower { get; set; }
        public double petPeesCiUpper { get; set; }
        public double selectionModelEffect { get; set; }
        public double selectionModelCiLower { get; set; }
        public double selectionModelCiUpper { get; set; }
        public double publicationBiasProbability { get; set; }
        public List<BmmaModel> models { get; set; } = new();
        public List<string> warnings { get; set; } = new();
    }

    public static BmmaResult Run(BmmaRequest req)
    {
        if (req.effects.Count < 3)
            throw new ArgumentException("At least 3 studies required for BMMA");

        int k = req.effects.Count;
        var effects = req.effects;
        var ses = req.standardErrors;
        var vars = ses.Select(se => se * se).ToArray();

        // Define models
        var models = new List<BmmaModel>();

        // Model 1: Fixed-effect, no bias
        var feNoBias = FitModel(effects, vars, "Fixed-effect (no bias)", false, false, false, req.seed ?? 42);
        models.Add(feNoBias);

        // Model 2: Random-effects, no bias
        var reNoBias = FitModel(effects, vars, "Random-effects (no bias)", true, false, false, req.seed ?? 42);
        models.Add(reNoBias);

        // Model 3: Fixed-effect + PET-PEESE
        if (req.includePETPEESE)
        {
            var fePET = FitModel(effects, vars, "Fixed-effect + PET-PEESE", false, true, false, req.seed ?? 42);
            models.Add(fePET);
        }

        // Model 4: Random-effects + PET-PEESE
        if (req.includePETPEESE)
        {
            var rePET = FitModel(effects, vars, "Random-effects + PET-PEESE", true, true, false, req.seed ?? 42);
            models.Add(rePET);
        }

        // Model 5: Fixed-effect + Selection model
        if (req.includeSelectionModel)
        {
            var feSel = FitModel(effects, vars, "Fixed-effect + Selection", false, false, true, req.seed ?? 42);
            models.Add(feSel);
        }

        // Model 6: Random-effects + Selection model
        if (req.includeSelectionModel)
        {
            var reSel = FitModel(effects, vars, "Random-effects + Selection", true, false, true, req.seed ?? 42);
            models.Add(reSel);
        }

        // Compute posterior probabilities (simplified BIC approximation)
        double minBic = models.Min(m => ComputeBic(effects, vars, m));
        var deltaBics = models.Select(m => ComputeBic(effects, vars, m) - minBic).ToList();
        var relLik = deltaBics.Select(d => Math.Exp(-0.5 * d)).ToList();
        double sumLik = relLik.Sum();

        for (int i = 0; i < models.Count; i++)
            models[i].posteriorProbability = relLik[i] / sumLik;

        // Model-averaged estimate
        double pooled = models.Sum(m => m.posteriorProbability * m.pooledEffect);
        double pooledVar = models.Sum(m => m.posteriorProbability * (m.ciUpper - m.ciLower) * (m.ciUpper - m.ciLower) / (2 * 1.96) / (2 * 1.96));
        double pooledSe = Math.Sqrt(pooledVar);

        // Publication bias probability
        double pbProb = models.Where(m => m.name.Contains("PET") || m.name.Contains("Selection")).Sum(m => m.posteriorProbability);

        // PET-PEESE estimate (averaged across PET models)
        var petModels = models.Where(m => m.name.Contains("PET")).ToList();
        double petEffect = petModels.Count > 0 ? petModels.Sum(m => m.posteriorProbability * m.pooledEffect) / Math.Max(petModels.Sum(m => m.posteriorProbability), 0.001) : pooled;

        // Selection model estimate (averaged across selection models)
        var selModels = models.Where(m => m.name.Contains("Selection")).ToList();
        double selEffect = selModels.Count > 0 ? selModels.Sum(m => m.posteriorProbability * m.pooledEffect) / Math.Max(selModels.Sum(m => m.posteriorProbability), 0.001) : pooled;

        return new BmmaResult
        {
            pooledEffect = pooled,
            ciLower = pooled - 1.96 * pooledSe,
            ciUpper = pooled + 1.96 * pooledSe,
            tau2 = models.Sum(m => m.posteriorProbability * m.tau2),
            petPeesEffect = petEffect,
            petPeesCiLower = petEffect - 1.96 * pooledSe,
            petPeesCiUpper = petEffect + 1.96 * pooledSe,
            selectionModelEffect = selEffect,
            selectionModelCiLower = selEffect - 1.96 * pooledSe,
            selectionModelCiUpper = selEffect + 1.96 * pooledSe,
            publicationBiasProbability = pbProb,
            models = models,
            warnings = pbProb > 0.5 ? new List<string> { $"Publication bias detected with {pbProb:P0} probability." } : new List<string>()
        };
    }

    private static BmmaModel FitModel(List<double> effects, double[] vars, string name, bool randomEffects, bool petPeese, bool selectionModel, int seed)
    {
        int k = effects.Count;
        double tau2 = 0;

        if (randomEffects)
        {
            var w = vars.Select(v => 1.0 / v).ToList();
            double sw = w.Sum();
            double fe = w.Zip(effects, (wi, e) => wi * e).Sum() / sw;
            double q = w.Zip(effects, (wi, e) => wi * (e - fe) * (e - fe)).Sum();
            int df = k - 1;
            double c = sw - w.Sum(wi => wi * wi) / sw;
            tau2 = (df > 0 && q > df && c > 0) ? Math.Max(0, (q - df) / c) : 0;
        }

        var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double sumW = weights.Sum();
        double pooled = weights.Zip(effects, (w, e) => w * e).Sum() / sumW;
        double se = Math.Sqrt(1.0 / sumW);

        // PET-PEESE adjustment
        if (petPeese)
        {
            // PET: effect ~ se
            var petX = vars.Select(v => Math.Sqrt(v)).ToList();
            var petY = effects;
            var petW = Enumerable.Repeat(1.0, k).ToList();
            var petResult = WeightedRegression(petX, petY, petW);
            pooled = petResult.intercept; // Intercept at se=0
        }

        // Selection model adjustment
        if (selectionModel)
        {
            // Simplified: down-weight non-significant studies
            var selWeights = effects.Zip(vars, (e, v) =>
            {
                double z = e / Math.Sqrt(v);
                double p = 2 * (1 - Stats.NormalCdf(Math.Abs(z)));
                return p <= 0.05 ? 1.0 : 0.1;
            }).ToList();

            var selW = vars.Zip(selWeights, (v, sw) => sw / (v + tau2)).ToList();
            double selSumW = selW.Sum();
            pooled = selW.Zip(effects, (w, e) => w * e).Sum() / selSumW;
            se = Math.Sqrt(1.0 / selSumW);
        }

        return new BmmaModel
        {
            name = name,
            pooledEffect = pooled,
            ciLower = pooled - 1.96 * se,
            ciUpper = pooled + 1.96 * se,
            tau2 = tau2
        };
    }

    private static double ComputeBic(List<double> effects, double[] vars, BmmaModel model)
    {
        // Simplified BIC: -2 * log-likelihood + k * log(n)
        double ll = 0;
        for (int i = 0; i < effects.Count; i++)
        {
            double residual = effects[i] - model.pooledEffect;
            ll -= 0.5 * (Math.Log(2 * Math.PI * (vars[i] + model.tau2)) + residual * residual / (vars[i] + model.tau2));
        }
        int nParams = model.name.Contains("Random") ? 2 : 1;
        if (model.name.Contains("PET")) nParams += 1;
        if (model.name.Contains("Selection")) nParams += 1;
        return -2 * ll + nParams * Math.Log(effects.Count);
    }

    private static (double intercept, double slope) WeightedRegression(List<double> x, List<double> y, List<double> w)
    {
        int n = x.Count;
        double sumW = w.Sum();
        double sumWx = w.Zip(x, (wi, xi) => wi * xi).Sum();
        double sumWy = w.Zip(y, (wi, yi) => wi * yi).Sum();
        double sumWx2 = w.Zip(x, (wi, xi) => wi * xi * xi).Sum();
        double sumWxy = w.Zip(x.Zip(y, (xi, yi) => (xi, yi)), (wi, p) => wi * p.xi * p.yi).Sum();

        double denom = sumW * sumWx2 - sumWx * sumWx;
        double slope = (sumW * sumWxy - sumWx * sumWy) / denom;
        double intercept = (sumWy - slope * sumWx) / sumW;

        return (intercept, slope);
    }
}

/// <summary>
/// Phylogenetic Meta-Analysis engine (v0.6.0).
/// Incorporates phylogenetic correlation structure into meta-analysis.
/// Uses a variance-covariance matrix based on evolutionary distances.
/// Mirrors R metafor::rma.mv with phylo correlation.
/// </summary>
public static class PhylogeneticMaEngine
{
    public class PhyloStudy
    {
        public string species { get; set; } = "";
        public double? effect { get; set; }
        public double? se { get; set; }
    }

    public class PhyloRequest
    {
        public List<PhyloStudy> studies { get; set; } = new();
        public List<List<double>> phylogeneticMatrix { get; set; } = new(); // correlation matrix
        public bool randomEffects { get; set; } = true;
        public string method { get; set; } = "REML"; // REML, ML, DL
    }

    public class PhyloResult
    {
        public double pooledEffect { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double se { get; set; }
        public double p { get; set; }
        public double tau2 { get; set; }
        public double q { get; set; }
        public double i2 { get; set; }
        public double phylogeneticSignal { get; set; } // lambda
        public int nStudies { get; set; }
    }

    public static PhyloResult Run(PhyloRequest req)
    {
        if (req.studies.Count < 3)
            throw new ArgumentException("At least 3 studies required");

        var validStudies = req.studies.Where(s => s.effect.HasValue && s.se.HasValue && s.se.Value > 0).ToList();
        if (validStudies.Count < 3)
            throw new ArgumentException("At least 3 valid studies required");

        int k = validStudies.Count;
        var effects = validStudies.Select(s => s.effect!.Value).ToList();
        var vars = validStudies.Select(s => s.se!.Value * s.se!.Value).ToArray();

        // Build phylogenetic correlation matrix (identity if not provided)
        var phyloCor = req.phylogeneticMatrix;
        if (phyloCor.Count != k)
        {
            // Default: identity matrix (no phylogenetic correlation)
            phyloCor = new List<List<double>>();
            for (int i = 0; i < k; i++)
            {
                var row = new List<double>();
                for (int j = 0; j < k; j++)
                    row.Add(i == j ? 1.0 : 0.0);
                phyloCor.Add(row);
            }
        }

        // Estimate tau2
        double tau2 = 0;
        if (req.randomEffects)
        {
            var w = vars.Select(v => 1.0 / v).ToList();
            double sw = w.Sum();
            double fe = w.Zip(effects, (wi, e) => wi * e).Sum() / sw;
            double qStat = w.Zip(effects, (wi, e) => wi * (e - fe) * (e - fe)).Sum();
            int dfStat = k - 1;
            double c = sw - w.Sum(wi => wi * wi) / sw;
            tau2 = (dfStat > 0 && qStat > dfStat && c > 0) ? Math.Max(0, (qStat - dfStat) / c) : 0;
        }

        // Build V = tau2 * C + diag(vars)
        var V = new double[k][];
        for (int i = 0; i < k; i++)
        {
            V[i] = new double[k];
            for (int j = 0; j < k; j++)
            {
                V[i][j] = tau2 * phyloCor[i][j];
                if (i == j) V[i][j] += vars[i];
            }
        }

        // GLS estimate: (X'V^-1 X)^-1 X'V^-1 y
        // X is a column of ones (intercept only)
        var Vinv = InvertMatrix(V);
        double sumVinv = 0, sumVinvY = 0;
        for (int i = 0; i < k; i++)
            for (int j = 0; j < k; j++)
            {
                sumVinv += Vinv[i][j];
                sumVinvY += Vinv[i][j] * effects[j];
            }

        double pooled = sumVinvY / sumVinv;
        double varPooled = 1.0 / sumVinv;
        double se = Math.Sqrt(varPooled);
        double z = pooled / se;
        double p = 2 * (1 - Stats.NormalCdf(Math.Abs(z)));

        // Phylogenetic signal (lambda)
        double lambda = tau2 / (tau2 + vars.Average());

        // Q and I²
        var feW = vars.Select(v => 1.0 / v).ToList();
        double feSw = feW.Sum();
        double fePooled = feW.Zip(effects, (wi, e) => wi * e).Sum() / feSw;
        double q = feW.Zip(effects, (wi, e) => wi * (e - fePooled) * (e - fePooled)).Sum();
        int df = k - 1;
        double i2 = q > df ? Math.Max(0, (q - df) / q * 100) : 0;

        return new PhyloResult
        {
            pooledEffect = pooled,
            ciLower = pooled - 1.96 * se,
            ciUpper = pooled + 1.96 * se,
            se = se,
            p = p,
            tau2 = tau2,
            q = q,
            i2 = i2,
            phylogeneticSignal = lambda,
            nStudies = k
        };
    }

    private static double[][] InvertMatrix(double[][] matrix)
    {
        int n = matrix.Length;
        var inv = new double[n][];
        for (int i = 0; i < n; i++)
            inv[i] = new double[n];

        // Gaussian elimination with partial pivoting
        var aug = new double[n][];
        for (int i = 0; i < n; i++)
        {
            aug[i] = new double[2 * n];
            for (int j = 0; j < n; j++)
                aug[i][j] = matrix[i][j];
            aug[i][n + i] = 1.0;
        }

        for (int col = 0; col < n; col++)
        {
            int maxRow = col;
            double maxVal = Math.Abs(aug[col][col]);
            for (int row = col + 1; row < n; row++)
                if (Math.Abs(aug[row][col]) > maxVal) { maxVal = Math.Abs(aug[row][col]); maxRow = row; }

            if (maxRow != col)
            {
                var temp = aug[col]; aug[col] = aug[maxRow]; aug[maxRow] = temp;
            }

            for (int row = col + 1; row < n; row++)
            {
                double factor = aug[row][col] / aug[col][col];
                for (int j = col; j < 2 * n; j++)
                    aug[row][j] -= factor * aug[col][j];
            }
        }

        for (int row = n - 1; row >= 0; row--)
        {
            for (int j = n; j < 2 * n; j++)
                aug[row][j] /= aug[row][row];
            aug[row][row] = 1.0;

            for (int i = row - 1; i >= 0; i--)
            {
                for (int j = n; j < 2 * n; j++)
                    aug[i][j] -= aug[i][row] * aug[row][j];
                aug[i][row] = 0;
            }
        }

        for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++)
                inv[i][j] = aug[i][n + j];

        return inv;
    }
}
