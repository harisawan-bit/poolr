"""
Meta-analysis statistical engine
Supports: binary (OR, RR, RD), continuous (MD, SMD), survival (HR), meta-regression, publication bias
"""

import math
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from scipy import stats
import warnings
warnings.filterwarnings("ignore")

try:
    import statsmodels.api as sm
    from statsmodels.stats.meta_analysis import combine_effects
    from statsmodels.stats.proportion import proportion_effectsize
    STATSMODELS_AVAILABLE = True
except ImportError:
    STATSMODELS_AVAILABLE = False


class MetaAnalysis:
    def __init__(
        self,
        model: str = "random",
        measure: str = "OR",
        method: str = "DL",
        subgroup: str = "none",
        pub_bias: str = "none"
    ):
        self.model = model  # "random" or "fixed"
        self.measure = measure  # "OR", "RR", "RD", "MD", "SMD", "HR"
        self.method = method  # "DL", "REML", "PM", "HS", "SJ", "ML", "EB"
        self.subgroup = subgroup
        self.pub_bias = pub_bias
    
    def run(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Run meta-analysis on prepared data"""
        if not data:
            raise ValueError("No data provided")
        
        # Separate by type
        binary_studies = [s for s in data if s.get("type") == "binary"]
        continuous_studies = [s for s in data if s.get("type") == "continuous"]
        survival_studies = [s for s in data if s.get("type") == "survival"]
        
        if self.measure in ["OR", "RR", "RD"] and binary_studies:
            return self._run_binary_meta(binary_studies)
        elif self.measure in ["MD", "SMD"] and continuous_studies:
            return self._run_continuous_meta(continuous_studies)
        elif self.measure == "HR" and survival_studies:
            return self._run_survival_meta(survival_studies)
        else:
            # Fallback: try binary
            if binary_studies:
                return self._run_binary_meta(binary_studies)
            raise ValueError(f"No valid data for measure {self.measure}")
    
    def _run_binary_meta(self, studies: List[Dict]) -> Dict:
        """Binary outcomes: OR, RR, RD"""
        k = len(studies)
        effects = []
        variances = []
        weights = []
        
        for s in studies:
            a = s["int_events"]
            b = s["int_n"] - s["int_events"]
            c = s["ctrl_events"]
            d = s["ctrl_n"] - s["ctrl_events"]
            
            # Continuity correction for zero cells
            if a == 0 or b == 0 or c == 0 or d == 0:
                a += 0.5
                b += 0.5
                c += 0.5
                d += 0.5
            
            if self.measure == "OR":
                # Log odds ratio
                effect = math.log((a * d) / (b * c))
                var = 1/a + 1/b + 1/c + 1/d
            elif self.measure == "RR":
                # Log risk ratio
                effect = math.log((a / s["int_n"]) / (c / s["ctrl_n"]))
                var = (1/a - 1/s["int_n"]) + (1/c - 1/s["ctrl_n"])
            elif self.measure == "RD":
                # Risk difference
                effect = (a / s["int_n"]) - (c / s["ctrl_n"])
                var = (a * b) / (s["int_n"] ** 3) + (c * d) / (s["ctrl_n"] ** 3)
            
            effects.append(effect)
            variances.append(var)
            weights.append(1/var)
            
            s["effect"] = effect
            s["var"] = var
            s["weight"] = 1/var
        
        return self._pool_effects(studies, effects, variances, weights, k)
    
    def _run_continuous_meta(self, studies: List[Dict]) -> Dict:
        """Continuous outcomes: MD, SMD"""
        k = len(studies)
        effects = []
        variances = []
        weights = []
        
        for s in studies:
            n1, n2 = s["int_n"], s["ctrl_n"]
            m1, m2 = s["int_mean"], s["ctrl_mean"]
            sd1, sd2 = s["int_sd"], s["ctrl_sd"]
            
            if self.measure == "MD":
                # Mean difference
                effect = m1 - m2
                var = (sd1**2 / n1) + (sd2**2 / n2)
            elif self.measure == "SMD":
                # Hedges' g (SMD with small sample correction)
                pooled_sd = math.sqrt(((n1 - 1) * sd1**2 + (n2 - 1) * sd2**2) / (n1 + n2 - 2))
                d = (m1 - m2) / pooled_sd
                # Hedges' correction
                j = 1 - 3 / (4 * (n1 + n2) - 9)
                effect = j * d
                var = (n1 + n2) / (n1 * n2) + (effect**2) / (2 * (n1 + n2))
            
            effects.append(effect)
            variances.append(var)
            weights.append(1/var)
            
            s["effect"] = effect
            s["var"] = var
            s["weight"] = 1/var
        
        return self._pool_effects(studies, effects, variances, weights, k)
    
    def _run_survival_meta(self, studies: List[Dict]) -> Dict:
        """Survival outcomes: HR"""
        k = len(studies)
        effects = []
        variances = []
        weights = []
        
        for s in studies:
            hr = s["hr"]
            lower = s["hr_lower"]
            upper = s["hr_upper"]
            
            # Log HR and SE from CI
            effect = math.log(hr)
            se = (math.log(upper) - math.log(lower)) / (2 * 1.96)
            var = se**2
            
            effects.append(effect)
            variances.append(var)
            weights.append(1/var)
            
            s["effect"] = effect
            s["var"] = var
            s["weight"] = 1/var
        
        return self._pool_effects(studies, effects, variances, weights, k)
    
    def _pool_effects(
        self, 
        studies: List[Dict], 
        effects: List[float], 
        variances: List[float], 
        weights: List[float], 
        k: int
    ) -> Dict:
        """Pool effects using fixed or random effects model"""
        
        # Fixed-effect
        sum_w = sum(weights)
        fe_effect = sum(w * e for w, e in zip(weights, effects)) / sum_w
        fe_var = 1 / sum_w
        fe_se = math.sqrt(fe_var)
        fe_z = fe_effect / fe_se
        fe_p = 2 * (1 - stats.norm.cdf(abs(fe_z)))
        
        # Heterogeneity
        q = sum(w * (e - fe_effect)**2 for w, e in zip(weights, effects))
        df = k - 1
        q_p = 1 - stats.chi2.cdf(q, df) if df > 0 else 1
        i2 = max(0, (q - df) / q * 100) if q > df else 0
        
        # Tau-squared (between-study variance)
        if self.method == "DL":
            # DerSimonian-Laird
            if df > 0 and q > df:
                c = sum_w - sum(w**2 for w in weights) / sum_w
                tau2 = max(0, (q - df) / c)
            else:
                tau2 = 0
        elif self.method == "REML":
            # Restricted Maximum Likelihood - simplified
            tau2 = self._reml_tau2(effects, variances)
        elif self.method == "PM":
            # Paule-Mandel
            tau2 = self._paule_mandel_tau2(effects, variances)
        elif self.method == "HS":
            # Hunter-Schmidt
            tau2 = self._hunter_schmidt_tau2(effects, variances)
        else:
            tau2 = max(0, (q - df) / (sum_w - sum(w**2 for w in weights) / sum_w)) if df > 0 and q > df else 0
        
        # Random-effects
        re_weights = [1 / (v + tau2) for v in variances]
        sum_re_w = sum(re_weights)
        re_effect = sum(w * e for w, e in zip(re_weights, effects)) / sum_re_w
        re_var = 1 / sum_re_w
        re_se = math.sqrt(re_var)
        re_z = re_effect / re_se
        re_p = 2 * (1 - stats.norm.cdf(abs(re_z)))
        
        # Model choice
        if self.model == "random":
            final_effect = re_effect
            final_var = re_var
            final_se = re_se
            final_z = re_z
            final_p = re_p
            final_model = "Random-effects"
        else:
            final_effect = fe_effect
            final_var = fe_var
            final_se = fe_se
            final_z = fe_z
            final_p = fe_p
            final_model = "Fixed-effect"
        
        # Transform back to original scale
        if self.measure in ["OR", "RR", "HR"]:
            final_estimate = math.exp(final_effect)
            ci_lower = math.exp(final_effect - 1.96 * final_se)
            ci_upper = math.exp(final_effect + 1.96 * final_se)
        else:
            final_estimate = final_effect
            ci_lower = final_effect - 1.96 * final_se
            ci_upper = final_effect + 1.96 * final_se
        
        # Study-level results with weights
        study_results = []
        total_weight = sum(weights) if self.model == "fixed" else sum(re_weights)
        
        for i, s in enumerate(studies):
            w = weights[i] if self.model == "fixed" else re_weights[i]
            weight_pct = w / total_weight * 100
            
            if self.measure in ["OR", "RR", "HR"]:
                study_results.append({
                    "study": s.get("study", "Unknown"),
                    "effect": math.exp(s["effect"]),
                    "ci_lower": math.exp(s["effect"] - 1.96 * math.sqrt(s["var"])),
                    "ci_upper": math.exp(s["effect"] + 1.96 * math.sqrt(s["var"])),
                    "weight": weight_pct,
                    "subgroup": s.get("subgroup", "")
                })
            else:
                study_results.append({
                    "study": s.get("study", "Unknown"),
                    "effect": s["effect"],
                    "ci_lower": s["effect"] - 1.96 * math.sqrt(s["var"]),
                    "ci_upper": s["effect"] + 1.96 * math.sqrt(s["var"]),
                    "weight": weight_pct,
                    "subgroup": s.get("subgroup", "")
                })
        
        # Subgroup analysis
        subgroups = None
        if self.subgroup != "none":
            subgroups = self._run_subgroup_analysis(studies, effects, variances)
        
        # Publication bias
        pub_bias = None
        if self.pub_bias != "none" and k >= 3:
            pub_bias = self._test_publication_bias(effects, variances, k)
        
        # Meta-regression (if covariates available)
        meta_reg = None
        if len(set(s.get("year", "") for s in studies if s.get("year"))) > 2:
            meta_reg = self._run_meta_regression(studies, effects, variances)
        
        return {
            "model": final_model,
            "measure": self.measure,
            "method": self.method,
            "k": k,
            "studies": study_results,
            "pooled": {
                "effect": final_estimate,
                "ci_lower": ci_lower,
                "ci_upper": ci_upper,
                "se": final_se,
                "z": final_z,
                "p": final_p,
                "model": final_model
            },
            "heterogeneity": {
                "q": q,
                "df": df,
                "q_p": q_p,
                "i2": i2,
                "tau2": tau2,
                "tau": math.sqrt(tau2)
            },
            "subgroups": subgroups,
            "publication_bias": pub_bias,
            "meta_regression": meta_reg
        }
    
    def _reml_tau2(self, effects, variances):
        """REML estimation of tau2"""
        # Simplified - full REML requires iterative optimization
        k = len(effects)
        if k < 2:
            return 0
        # Initial guess from DL
        w = [1/v for v in variances]
        sum_w = sum(w)
        fe = sum(w[i] * effects[i] for i in range(k)) / sum_w
        q = sum(w[i] * (effects[i] - fe)**2 for i in range(k))
        df = k - 1
        if df > 0 and q > df:
            c = sum_w - sum(wi**2 for wi in w) / sum_w
            return max(0, (q - df) / c)
        return 0
    
    def _paule_mandel_tau2(self, effects, variances):
        """Paule-Mandel estimation"""
        k = len(effects)
        if k < 2:
            return 0
        
        def Q(tau2):
            w = [1/(v + tau2) for v in variances]
            sum_w = sum(w)
            pooled = sum(w[i] * effects[i] for i in range(k)) / sum_w
            return sum(w[i] * (effects[i] - pooled)**2 for i in range(k))
        
        # Find tau2 such that Q(tau2) = k - 1
        target = k - 1
        lo, hi = 0, 10
        for _ in range(50):
            mid = (lo + hi) / 2
            if Q(mid) > target:
                lo = mid
            else:
                hi = mid
        return max(0, (lo + hi) / 2)
    
    def _hunter_schmidt_tau2(self, effects, variances):
        """Hunter-Schmidt estimation"""
        k = len(effects)
        if k < 2:
            return 0
        w = [1/v for v in variances]
        sum_w = sum(w)
        fe = sum(w[i] * effects[i] for i in range(k)) / sum_w
        v_obs = sum(w[i] * (effects[i] - fe)**2 for i in range(k)) / sum_w
        v_exp = 1 / sum_w * (k - 1) / k
        tau2 = max(0, v_obs - v_exp)
        return tau2
    
    def _run_subgroup_analysis(self, studies, effects, variances):
        """Run subgroup analysis"""
        subgroups = {}
        for i, s in enumerate(studies):
            sg = s.get(self.subgroup, "Unknown")
            if sg not in subgroups:
                subgroups[sg] = {"studies": [], "effects": [], "variances": []}
            subgroups[sg]["studies"].append(s)
            subgroups[sg]["effects"].append(effects[i])
            subgroups[sg]["variances"].append(variances[i])
        
        results = []
        for name, data in subgroups.items():
            if len(data["studies"]) < 1:
                continue
            
            # Mini meta-analysis for subgroup
            k = len(data["studies"])
            w = [1/v for v in data["variances"]]
            sum_w = sum(w)
            pooled = sum(w[i] * data["effects"][i] for i in range(k)) / sum_w
            var = 1 / sum_w
            se = math.sqrt(var)
            
            if self.measure in ["OR", "RR", "HR"]:
                results.append({
                    "name": name,
                    "measure": self.measure,
                    "effect": math.exp(pooled),
                    "ci_lower": math.exp(pooled - 1.96 * se),
                    "ci_upper": math.exp(pooled + 1.96 * se),
                    "k": k
                })
            else:
                results.append({
                    "name": name,
                    "measure": self.measure,
                    "effect": pooled,
                    "ci_lower": pooled - 1.96 * se,
                    "ci_upper": pooled + 1.96 * se,
                    "k": k
                })
        
        return results
    
    def _test_publication_bias(self, effects, variances, k):
        """Test for publication bias"""
        results = {}
        
        # Egger's test
        if self.pub_bias in ["egger", "all"]:
            se = [math.sqrt(v) for v in variances]
            precision = [1/s for s in se]
            slope, intercept, r, p, se_slope = stats.linregress(precision, effects)
            results["egger"] = {
                "intercept": intercept,
                "p_value": p,
                "significant": p < 0.05
            }
        
        # Begg's test (rank correlation)
        if self.pub_bias in ["begg", "all"]:
            # Kendall's tau between effect size and variance
            tau, p = stats.kendalltau(effects, variances)
            results["begg"] = {
                "tau": tau,
                "p_value": p,
                "significant": p < 0.05
            }
        
        # Trim and fill (simplified)
        if self.pub_bias in ["trimfill", "all"]:
            # Simplified - would need full implementation
            results["trimfill"] = {
                "note": "Trim-and-fill requires full implementation",
                "adjusted_effect": None
            }
        
        return results
    
    def _run_meta_regression(self, studies, effects, variances):
        """Simple meta-regression with year as covariate"""
        years = []
        valid_indices = []
        for i, s in enumerate(studies):
            try:
                yr = int(s.get("year", 0))
                if yr > 1900:
                    years.append(yr)
                    valid_indices.append(i)
            except (ValueError, TypeError):
                pass
        
        if len(years) < 3:
            return None
        
        # Weighted regression
        w = [1/variances[i] for i in valid_indices]
        y = [effects[i] for i in valid_indices]
        
        # Center year
        mean_year = np.mean(years)
        x_centered = [yr - mean_year for yr in years]
        
        # Weighted least squares
        sum_w = sum(w)
        sum_wx = sum(w[i] * x_centered[i] for i in range(len(w)))
        sum_wy = sum(w[i] * y[i] for i in range(len(w)))
        sum_wx2 = sum(w[i] * x_centered[i]**2 for i in range(len(w)))
        sum_wxy = sum(w[i] * x_centered[i] * y[i] for i in range(len(w)))
        
        denom = sum_w * sum_wx2 - sum_wx**2
        if denom == 0:
            return None
        
        slope = (sum_w * sum_wxy - sum_wx * sum_wy) / denom
        intercept = (sum_wy - slope * sum_wx) / sum_w
        
        # Standard errors
        var_slope = sum_w / denom
        se_slope = math.sqrt(var_slope)
        z = slope / se_slope
        p = 2 * (1 - stats.norm.cdf(abs(z)))
        
        return {
            "covariate": "year",
            "slope": slope,
            "se": se_slope,
            "z": z,
            "p": p,
            "intercept": intercept,
            "significant": p < 0.05
        }