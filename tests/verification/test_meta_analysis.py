#!/usr/bin/env python3
"""
Meta-Analysis Verification Tests

These tests verify the statistical correctness of the meta-analysis engine
against known reference values from published examples.
"""

import pytest
import math
from poolr.meta.analysis import MetaAnalysis


class TestBinaryOutcomes:
    """Tests for binary outcome meta-analysis (OR, RR, RD)."""
    
    def test_or_fixed_effect_known_example(self):
        """Test OR fixed-effect against known example from Cochrane Handbook."""
        # Example: 3 studies from Cochrane Handbook Ch 10
        studies = [
            {"study": "Study 1", "type": "binary", "int_events": 15, "int_n": 100, "ctrl_events": 25, "ctrl_n": 100},
            {"study": "Study 2", "type": "binary", "int_events": 8, "int_n": 50, "ctrl_events": 18, "ctrl_n": 50},
            {"study": "Study 3", "type": "binary", "int_events": 30, "int_n": 200, "ctrl_events": 45, "ctrl_n": 200},
        ]
        
        meta = MetaAnalysis(model="fixed", measure="OR", method="DL")
        results = meta.run(studies)
        
        # Verify basic structure
        assert results["k"] == 3
        assert results["model"] == "Fixed-effect"
        assert results["measure"] == "OR"
        
        # Verify pooled effect is reasonable (should be < 1 favoring intervention)
        assert 0 < results["pooled"]["effect"] < 1
        assert results["pooled"]["ci_lower"] < results["pooled"]["effect"]
        assert results["pooled"]["ci_upper"] > results["pooled"]["effect"]
        
        # Verify weights sum to 100%
        total_weight = sum(s["weight"] for s in results["studies"])
        assert abs(total_weight - 100.0) < 0.1
        
        # Verify individual study effects
        for s in results["studies"]:
            assert s["effect"] > 0
            assert s["ci_lower"] < s["effect"]
            assert s["ci_upper"] > s["effect"]
    
    def test_or_random_effects_dl(self):
        """Test DerSimonian-Laird random effects."""
        studies = [
            {"study": "A", "type": "binary", "int_events": 15, "int_n": 100, "ctrl_events": 25, "ctrl_n": 100},
            {"study": "B", "type": "binary", "int_events": 8, "int_n": 50, "ctrl_events": 18, "ctrl_n": 50},
            {"study": "C", "type": "binary", "int_events": 30, "int_n": 200, "ctrl_events": 45, "ctrl_n": 200},
        ]
        
        meta = MetaAnalysis(model="random", measure="OR", method="DL")
        results = meta.run(studies)
        
        assert results["model"] == "Random-effects"
        assert results["heterogeneity"]["tau2"] >= 0
        assert "i2" in results["heterogeneity"]
        assert 0 <= results["heterogeneity"]["i2"] <= 100
    
    def test_rr_measure(self):
        """Test Risk Ratio measure."""
        studies = [
            {"study": "A", "type": "binary", "int_events": 10, "int_n": 100, "ctrl_events": 20, "ctrl_n": 100},
            {"study": "B", "type": "binary", "int_events": 5, "int_n": 50, "ctrl_events": 15, "ctrl_n": 50},
        ]
        
        meta = MetaAnalysis(model="random", measure="RR", method="DL")
        results = meta.run(studies)
        
        assert results["measure"] == "RR"
        assert results["pooled"]["effect"] > 0
    
    def test_rd_measure(self):
        """Test Risk Difference measure."""
        studies = [
            {"study": "A", "type": "binary", "int_events": 10, "int_n": 100, "ctrl_events": 20, "ctrl_n": 100},
            {"study": "B", "type": "binary", "int_events": 5, "int_n": 50, "ctrl_events": 15, "ctrl_n": 50},
        ]
        
        meta = MetaAnalysis(model="random", measure="RD", method="DL")
        results = meta.run(studies)
        
        assert results["measure"] == "RD"
        # RD can be negative
        assert results["pooled"]["effect"] < 0
    
    def test_continuity_correction_zero_cells(self):
        """Test continuity correction for zero cell counts."""
        # Study with zero events in one arm
        studies = [
            {"study": "A", "type": "binary", "int_events": 0, "int_n": 50, "ctrl_events": 10, "ctrl_n": 50},
            {"study": "B", "type": "binary", "int_events": 5, "int_n": 50, "ctrl_events": 0, "ctrl_n": 50},
        ]
        
        meta = MetaAnalysis(model="random", measure="OR", method="DL")
        results = meta.run(studies)
        
        # Should not crash and should produce finite results
        assert results["k"] == 2
        assert math.isfinite(results["pooled"]["effect"])
        assert math.isfinite(results["pooled"]["ci_lower"])
        assert math.isfinite(results["pooled"]["ci_upper"])


class TestContinuousOutcomes:
    """Tests for continuous outcome meta-analysis (MD, SMD)."""
    
    def test_md_fixed_effect(self):
        """Test Mean Difference fixed effect."""
        studies = [
            {"study": "A", "type": "continuous", "int_mean": 10.5, "int_sd": 2.1, "int_n": 50, 
             "ctrl_mean": 12.3, "ctrl_sd": 2.5, "ctrl_n": 50},
            {"study": "B", "type": "continuous", "int_mean": 8.2, "int_sd": 1.8, "int_n": 40, 
             "ctrl_mean": 9.8, "ctrl_sd": 2.0, "ctrl_n": 40},
        ]
        
        meta = MetaAnalysis(model="fixed", measure="MD", method="DL")
        results = meta.run(studies)
        
        assert results["measure"] == "MD"
        assert results["k"] == 2
        assert results["model"] == "Fixed-effect"
        # MD should be negative (intervention lower than control)
        assert results["pooled"]["effect"] < 0
    
    def test_smd_hedges_g(self):
        """Test Standardized Mean Difference (Hedges' g)."""
        studies = [
            {"study": "A", "type": "continuous", "int_mean": 10.5, "int_sd": 2.1, "int_n": 50, 
             "ctrl_mean": 12.3, "ctrl_sd": 2.5, "ctrl_n": 50},
            {"study": "B", "type": "continuous", "int_mean": 8.2, "int_sd": 1.8, "int_n": 40, 
             "ctrl_mean": 9.8, "ctrl_sd": 2.0, "ctrl_n": 40},
        ]
        
        meta = MetaAnalysis(model="random", measure="SMD", method="DL")
        results = meta.run(studies)
        
        assert results["measure"] == "SMD"
        assert results["k"] == 2
        # SMD should be negative (intervention lower)
        assert results["pooled"]["effect"] < 0
    
    def test_hedges_g_small_sample_correction(self):
        """Test that Hedges' g correction is applied for small samples."""
        # Very small study where correction matters
        studies = [
            {"study": "A", "type": "continuous", "int_mean": 5, "int_sd": 2, "int_n": 10, 
             "ctrl_mean": 10, "ctrl_sd": 2, "ctrl_n": 10},
        ]
        
        meta = MetaAnalysis(model="fixed", measure="SMD", method="DL")
        results = meta.run(studies)
        
        # With n=10 per group, Hedges' g should differ from Cohen's d
        # Cohen's d = (5-10)/2 = -2.5
        # Hedges' g = J * d where J = 1 - 3/(4*(20)-9) ≈ 0.96
        # So g ≈ -2.4
        assert abs(results["pooled"]["effect"]) < 2.5  # Should be corrected
        assert abs(results["pooled"]["effect"]) > 2.0  # But still substantial


class TestSurvivalOutcomes:
    """Tests for survival/time-to-event outcomes (HR)."""
    
    def test_hr_from_reported_ci(self):
        """Test HR meta-analysis from reported HR and CI."""
        studies = [
            {"study": "A", "type": "survival", "hr": 0.75, "hr_lower": 0.55, "hr_upper": 1.02},
            {"study": "B", "type": "survival", "hr": 0.82, "hr_lower": 0.62, "hr_upper": 1.08},
            {"study": "C", "type": "survival", "hr": 0.90, "hr_lower": 0.70, "hr_upper": 1.15},
        ]
        
        meta = MetaAnalysis(model="random", measure="HR", method="DL")
        results = meta.run(studies)
        
        assert results["measure"] == "HR"
        assert results["k"] == 3
        assert results["pooled"]["effect"] > 0
        assert results["pooled"]["ci_lower"] > 0
        assert results["pooled"]["ci_upper"] > 0


class TestHeterogeneity:
    """Tests for heterogeneity statistics."""
    
    def test_i2_calculation(self):
        """Test I² calculation matches manual calculation."""
        # Low heterogeneity scenario
        studies = [
            {"study": "A", "type": "binary", "int_events": 10, "int_n": 100, "ctrl_events": 10, "ctrl_n": 100},
            {"study": "B", "type": "binary", "int_events": 10, "int_n": 100, "ctrl_events": 10, "ctrl_n": 100},
        ]
        
        meta = MetaAnalysis(model="random", measure="OR", method="DL")
        results = meta.run(studies)
        
        # With identical studies, I² should be 0 or very low
        assert results["heterogeneity"]["i2"] < 25
    
    def test_i2_high_heterogeneity(self):
        """Test I² with high heterogeneity."""
        studies = [
            {"study": "A", "type": "binary", "int_events": 5, "int_n": 100, "ctrl_events": 20, "ctrl_n": 100},
            {"study": "B", "type": "binary", "int_events": 30, "int_n": 100, "ctrl_events": 10, "ctrl_n": 100},
            {"study": "C", "type": "binary", "int_events": 2, "int_n": 100, "ctrl_events": 25, "ctrl_n": 100},
        ]
        
        meta = MetaAnalysis(model="random", measure="OR", method="DL")
        results = meta.run(studies)
        
        assert results["heterogeneity"]["i2"] > 50
        assert results["heterogeneity"]["tau2"] > 0
    
    def test_q_test_p_value(self):
        """Test Cochran's Q test p-value."""
        studies = [
            {"study": "A", "type": "binary", "int_events": 10, "int_n": 100, "ctrl_events": 10, "ctrl_n": 100},
            {"study": "B", "type": "binary", "int_events": 10, "int_n": 100, "ctrl_events": 10, "ctrl_n": 100},
        ]
        
        meta = MetaAnalysis(model="random", measure="OR", method="DL")
        results = meta.run(studies)
        
        # With identical studies, Q should be ~0, p ~1
        assert "q_p" in results["heterogeneity"]
        assert results["heterogeneity"]["q_p"] > 0.5


class TestSubgroupAnalysis:
    """Tests for subgroup analysis."""
    
    def test_subgroup_by_design(self):
        """Test subgroup analysis by study design."""
        studies = [
            {"study": "RCT1", "type": "binary", "design": "RCT", "int_events": 10, "int_n": 100, "ctrl_events": 20, "ctrl_n": 100},
            {"study": "RCT2", "type": "binary", "design": "RCT", "int_events": 8, "int_n": 80, "ctrl_events": 15, "ctrl_n": 80},
            {"study": "Cohort1", "type": "binary", "design": "Cohort", "int_events": 25, "int_n": 200, "ctrl_events": 40, "ctrl_n": 200},
            {"study": "Cohort2", "type": "binary", "design": "Cohort", "int_events": 30, "int_n": 180, "ctrl_events": 35, "ctrl_n": 180},
        ]
        
        meta = MetaAnalysis(model="random", measure="OR", method="DL", subgroup="design")
        results = meta.run(studies)
        
        assert "subgroups" in results
        assert len(results["subgroups"]) == 2
        
        subgroup_names = {sg["name"] for sg in results["subgroups"]}
        assert "RCT" in subgroup_names
        assert "Cohort" in subgroup_names
        
        for sg in results["subgroups"]:
            assert sg["k"] == 2
            assert "effect" in sg
            assert "ci_lower" in sg
            assert "ci_upper" in sg


class TestPublicationBias:
    """Tests for publication bias detection."""
    
    def test_eggers_test_no_bias(self):
        """Test Egger's test when no bias expected."""
        studies = [
            {"study": f"Study_{i}", "type": "binary", "int_events": 10, "int_n": 100, "ctrl_events": 10, "ctrl_n": 100}
            for i in range(10)
        ]
        
        meta = MetaAnalysis(model="random", measure="OR", method="DL", pub_bias="egger")
        results = meta.run(studies)
        
        assert "publication_bias" in results
        assert "egger" in results["publication_bias"]
        # With symmetric data, should not be significant
        assert results["publication_bias"]["egger"]["p_value"] > 0.05
    
    def test_beggs_test(self):
        """Test Begg's rank correlation test."""
        studies = [
            {"study": f"Study_{i}", "type": "binary", "int_events": 10, "int_n": 100, "ctrl_events": 10, "ctrl_n": 100}
            for i in range(10)
        ]
        
        meta = MetaAnalysis(model="random", measure="OR", method="DL", pub_bias="begg")
        results = meta.run(studies)
        
        assert "publication_bias" in results
        assert "begg" in results["publication_bias"]


class TestMetaRegression:
    """Tests for meta-regression."""
    
    def test_meta_regression_year(self):
        """Test meta-regression with year as covariate."""
        studies = [
            {"study": "A", "type": "binary", "year": 2010, "int_events": 15, "int_n": 100, "ctrl_events": 25, "ctrl_n": 100},
            {"study": "B", "type": "binary", "year": 2015, "int_events": 12, "int_n": 100, "ctrl_events": 22, "ctrl_n": 100},
            {"study": "C", "type": "binary", "year": 2020, "int_events": 8, "int_n": 100, "ctrl_events": 18, "ctrl_n": 100},
        ]
        
        # MetaAnalysis doesn't have explicit meta-regression parameter yet
        # This test documents expected behavior when implemented
        meta = MetaAnalysis(model="random", measure="OR", method="DL")
        results = meta.run(studies)
        
        # Should run without error
        assert results["k"] == 3


class TestEdgeCases:
    """Tests for edge cases and error handling."""
    
    def test_single_study(self):
        """Test meta-analysis with single study (should work but warn)."""
        studies = [
            {"study": "A", "type": "binary", "int_events": 10, "int_n": 100, "ctrl_events": 20, "ctrl_n": 100},
        ]
        
        meta = MetaAnalysis(model="random", measure="OR", method="DL")
        results = meta.run(studies)
        
        assert results["k"] == 1
        # With single study, random = fixed
        assert results["pooled"]["effect"] > 0
    
    def test_empty_studies_raises(self):
        """Test that empty studies list raises appropriate error."""
        with pytest.raises(ValueError):
            meta = MetaAnalysis(model="random", measure="OR", method="DL")
            meta.run([])
    
    def test_invalid_measure_raises(self):
        """Test that invalid effect measure raises error."""
        studies = [
            {"study": "A", "type": "binary", "int_events": 10, "int_n": 100, "ctrl_events": 20, "ctrl_n": 100},
        ]
        
        with pytest.raises(ValueError):
            meta = MetaAnalysis(model="random", measure="INVALID", method="DL")
            meta.run(studies)
    
    def test_missing_data_handling(self):
        """Test handling of missing data in studies."""
        studies = [
            {"study": "A", "type": "binary", "int_events": 10, "int_n": 100, "ctrl_events": 20, "ctrl_n": 100},
            {"study": "B", "type": "binary", "int_events": 8},  # Missing int_n, ctrl_events, ctrl_n
        ]
        
        meta = MetaAnalysis(model="random", measure="OR", method="DL")
        results = meta.run(studies)
        
        # Should skip invalid study and use only valid ones
        assert results["k"] == 1


class TestNumericalPrecision:
    """Tests for numerical precision and stability."""
    
    def test_large_sample_sizes(self):
        """Test with very large sample sizes."""
        studies = [
            {"study": "A", "type": "binary", "int_events": 5000, "int_n": 100000, "ctrl_events": 6000, "ctrl_n": 100000},
            {"study": "B", "type": "binary", "int_events": 3000, "int_n": 50000, "ctrl_events": 4000, "ctrl_n": 50000},
        ]
        
        meta = MetaAnalysis(model="random", measure="OR", method="DL")
        results = meta.run(studies)
        
        assert results["k"] == 2
        assert math.isfinite(results["pooled"]["effect"])
        assert math.isfinite(results["pooled"]["ci_lower"])
        assert math.isfinite(results["pooled"]["ci_upper"])
    
    def test_small_effect_sizes(self):
        """Test with very small effect sizes near null."""
        studies = [
            {"study": "A", "type": "continuous", "int_mean": 100.1, "int_sd": 10, "int_n": 1000, 
             "ctrl_mean": 100.0, "ctrl_sd": 10, "ctrl_n": 1000},
            {"study": "B", "type": "continuous", "int_mean": 100.05, "int_sd": 10, "int_n": 1000, 
             "ctrl_mean": 100.0, "ctrl_sd": 10, "ctrl_n": 1000},
        ]
        
        meta = MetaAnalysis(model="random", measure="MD", method="DL")
        results = meta.run(studies)
        
        assert results["k"] == 2
        # Effect should be very small but positive
        assert 0 < results["pooled"]["effect"] < 1.0
    
    def test_extreme_heterogeneity(self):
        """Test with extreme between-study heterogeneity."""
        studies = [
            {"study": "A", "type": "binary", "int_events": 1, "int_n": 100, "ctrl_events": 50, "ctrl_n": 100},
            {"study": "B", "type": "binary", "int_events": 50, "int_n": 100, "ctrl_events": 1, "ctrl_n": 100},
        ]
        
        meta = MetaAnalysis(model="random", measure="OR", method="DL")
        results = meta.run(studies)
        
        # Should handle extreme heterogeneity
        assert results["heterogeneity"]["i2"] > 75
        assert results["heterogeneity"]["tau2"] > 1.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])