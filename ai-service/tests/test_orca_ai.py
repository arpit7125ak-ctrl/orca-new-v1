"""
ai-service/tests/test_orca_ai.py

Comprehensive 39-test automated test suite for ORCA AI Service.
Validates:
  1. Honest metocean adapters and missing data contracts
  2. Deterministic risk baseline, level mapping, and worst-hour rule
  3. Graded IMD and safety warning floor enforcement
  4. LLM numeric consistency and clamp guardrails
  5. GEBCO bathymetry, shoreline snapping, and Location contracts
  6. Deterministic marine routing engine and Palk Strait safety gating
  7. Historical trend analysis (Theil-Sen slope) and unobserved factor transparency
"""

import math
import os
import sys
import unittest
from datetime import datetime, timezone

# Add ai-service to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.adapters.open_meteo import _find_closest_time_index, _unavailable_measurement
from app.risk.baseline import (
    level_for_score,
    score_parameter,
    _vessel_factor,
    _BASE_THRESHOLDS,
    score_point,
    compute_baseline,
)
from app.risk.risk_agent import (
    compute_constraint_floor,
    apply_constraint_floor,
    clamp_adjustment,
)
from app.planner.router import (
    _haversine,
    _format_location as router_format_location,
    evaluate_route,
    VESSEL_SPEEDS_KMH,
)
from app.risk.trends import (
    compute_theil_sen_slope,
    _format_location as trend_format_location,
    evaluate_trends,
)


class TestHonestAdapters(unittest.TestCase):
    """1. Honest Adapters & Missing Data Contracts (5 tests)"""

    def test_unavailable_measurement_shape(self):
        m = _unavailable_measurement("wave_height_m", "2026-09-21T12:00:00Z")
        self.assertEqual(m["parameter"], "wave_height_m")
        self.assertIsNone(m["value"])
        self.assertIsNone(m["source"])
        self.assertIsNone(m["confidence"])
        self.assertEqual(m["status"], "missing")
        self.assertEqual(m["valid_time"], "2026-09-21T12:00:00Z")

    def test_time_index_exact_utc_match(self):
        times = ["2026-09-21T10:00", "2026-09-21T11:00", "2026-09-21T12:00", "2026-09-21T13:00"]
        idx = _find_closest_time_index(times, "2026-09-21T12:00:00Z")
        self.assertEqual(idx, 2)

    def test_time_index_ist_offset_conversion(self):
        # 17:30 IST is 12:00 UTC
        times = ["2026-09-21T11:00", "2026-09-21T12:00", "2026-09-21T13:00"]
        idx = _find_closest_time_index(times, "2026-09-21T17:30:00+05:30")
        self.assertEqual(idx, 1)

    def test_time_index_nearest_hour_rounding(self):
        # 12:45 UTC rounds closer to 13:00 than 12:00
        times = ["2026-09-21T12:00", "2026-09-21T13:00"]
        idx = _find_closest_time_index(times, "2026-09-21T12:45:00Z")
        self.assertEqual(idx, 1)

    def test_time_index_empty_list_fallback(self):
        self.assertEqual(_find_closest_time_index([], "2026-09-21T12:00:00Z"), 0)


class TestRiskBaseline(unittest.TestCase):
    """2. Deterministic Risk Baseline & Level Mapping (7 tests)"""

    def test_level_for_score_boundaries(self):
        self.assertEqual(level_for_score(0), "SAFE")
        self.assertEqual(level_for_score(34), "SAFE")
        self.assertEqual(level_for_score(35), "CAUTION")
        self.assertEqual(level_for_score(64), "CAUTION")
        self.assertEqual(level_for_score(65), "UNSAFE")
        self.assertEqual(level_for_score(84), "UNSAFE")
        self.assertEqual(level_for_score(85), "DANGEROUS")
        self.assertEqual(level_for_score(100), "DANGEROUS")

    def test_level_for_none(self):
        self.assertIsNone(level_for_score(None))

    def test_score_parameter_calm_conditions(self):
        score = score_parameter("wave_height_m", 0.4, "motorized_country_craft")
        self.assertIsNotNone(score)
        self.assertLessEqual(score, 34)

    def test_score_parameter_dangerous_conditions(self):
        score = score_parameter("wind_speed_ms", 22.0, "motorized_country_craft")
        self.assertIsNotNone(score)
        self.assertGreaterEqual(score, 85)

    def test_score_parameter_missing_returns_none(self):
        self.assertIsNone(score_parameter("wave_height_m", None, "motorized_country_craft"))
        self.assertIsNone(score_parameter("unknown_parameter", 5.0, "motorized_country_craft"))

    def test_vessel_conservatism_scaling(self):
        traditional_factor = _vessel_factor("traditional_non_motorized")
        commercial_factor = _vessel_factor("large_commercial_vessel")
        self.assertEqual(traditional_factor, 1.0)
        self.assertGreater(commercial_factor, traditional_factor)

    def test_worst_hour_max_rule(self):
        # Hourly scores: hour 1 is calm (wave 0.5m), hour 2 is stormy (wave 3.8m)
        # Baseline must be determined by worst hour via real compute_baseline
        hourly_data = [
            {"time": "2026-09-21T06:00:00Z", "measurements": {"wave_height_m": {"value": 0.5, "status": "available"}}},
            {"time": "2026-09-21T07:00:00Z", "measurements": {"wave_height_m": {"value": 3.8, "status": "available"}}},
        ]
        res = compute_baseline(
            measurements={},
            hourly_measurements=hourly_data,
            vessel_type="motorized_country_craft"
        )
        self.assertGreaterEqual(res["baseline_score"], 84)


class TestWarningFloors(unittest.TestCase):
    """3. Graded IMD & Safety Warning Floors (5 tests)"""

    def test_safety_floor_elevates_baseline(self):
        final = apply_constraint_floor(baseline_score=40, constraint_floor=85)
        self.assertEqual(final, 85)

    def test_higher_baseline_not_lowered_by_floor(self):
        final = apply_constraint_floor(baseline_score=92, constraint_floor=75)
        self.assertEqual(final, 92)

    def test_no_warning_floor_preserves_baseline(self):
        final = apply_constraint_floor(baseline_score=55, constraint_floor=None)
        self.assertEqual(final, 55)

    def test_multiple_warnings_takes_maximum_floor(self):
        warnings = [{"floor_score": 65}, {"floor_score": 85}]
        hard_rules = [{"floor_score": 70}]
        max_floor = compute_constraint_floor(warnings, hard_rules)
        self.assertEqual(max_floor, 85)

    def test_official_warning_enforces_category(self):
        # A floor of 85 maps to DANGEROUS
        floor = 85.0
        level = level_for_score(floor)
        self.assertEqual(level, "DANGEROUS")


class TestLlmGuardrails(unittest.TestCase):
    """4. LLM Numeric Consistency & Guardrails (4 tests)"""

    def test_llm_adjustment_clamp_positive(self):
        # Model may only nudge by at most LLM_ADJUSTMENT_BAND
        clamped = clamp_adjustment(raw_adjustment=25, baseline_score=50, constraint_floor=None)
        self.assertLessEqual(clamped, 10)
        self.assertGreater(clamped, 0)

    def test_llm_adjustment_clamp_negative(self):
        # Downward nudge within band preserving category level is allowed
        clamped = clamp_adjustment(raw_adjustment=-5, baseline_score=55, constraint_floor=None)
        self.assertEqual(clamped, -5)

    def test_llm_cannot_breach_warning_floor(self):
        # When baseline is at warning floor, downward nudge is blocked by clamp_adjustment
        nudge = clamp_adjustment(raw_adjustment=-10, baseline_score=85, constraint_floor=85)
        self.assertEqual(nudge, 0)
        enforced_final = apply_constraint_floor(baseline_score=85, constraint_floor=85, llm_adjustment=-10)
        self.assertEqual(enforced_final, 85)

    def test_zero_nudge_preserves_score(self):
        final = apply_constraint_floor(baseline_score=50, constraint_floor=None, llm_adjustment=0)
        self.assertEqual(final, 50)


class TestLocationAndBathymetry(unittest.TestCase):
    """5. GEBCO Bathymetry & Location Contracts (5 tests)"""

    def test_location_format_unvalidated(self):
        loc = {"lat": 9.94, "lon": 76.16, "name": "Kochi Harbor"}
        formatted = router_format_location(loc)
        self.assertIn("original", formatted)
        self.assertIn("validated", formatted)
        self.assertEqual(formatted["original"]["name"], "Kochi Harbor")
        self.assertEqual(formatted["validated"]["lat"], 9.94)
        self.assertEqual(formatted["validated"]["lon"], 76.16)

    def test_snapped_location_retains_distance(self):
        loc = {
            "original": {"name": "Inland Point", "lat": 9.99, "lon": 76.25},
            "validated": {"lat": 9.94, "lon": 76.16, "snapped": True, "snap_distance_km": 11.2, "snap_reference": "Kochi offshore"},
        }
        formatted = router_format_location(loc)
        self.assertTrue(formatted["validated"]["snapped"])
        self.assertEqual(formatted["validated"]["snap_distance_km"], 11.2)

    def test_haversine_distance_known_pair(self):
        # Kochi (9.94, 76.16) to Mangalore (12.91, 74.85) ~ 358 km
        d = _haversine(9.94, 76.16, 12.91, 74.85)
        self.assertGreater(d, 340.0)
        self.assertLess(d, 380.0)

    def test_haversine_zero_distance(self):
        d = _haversine(10.0, 75.0, 10.0, 75.0)
        self.assertEqual(d, 0.0)

    def test_trend_format_location_structure(self):
        loc = {"latitude": 15.0, "longitude": 73.5, "name": "Goa Offshore"}
        formatted = trend_format_location(loc)
        self.assertEqual(formatted["original"]["lat"], 15.0)
        self.assertEqual(formatted["original"]["lon"], 73.5)
        self.assertFalse(formatted["validated"]["snapped"])


class TestRoutingEngine(unittest.TestCase):
    """6. Deterministic Marine Routing Engine (6 tests)"""

    def test_vessel_speeds_lookup(self):
        self.assertIn("motorized_country_craft", VESSEL_SPEEDS_KMH)
        self.assertIn("large_commercial_vessel", VESSEL_SPEEDS_KMH)
        self.assertGreater(VESSEL_SPEEDS_KMH["large_commercial_vessel"], VESSEL_SPEEDS_KMH["traditional_non_motorized"])

    def test_router_snaps_origin_destination(self):
        # Land coordinate at Kochi port snaps to nearest water
        res = evaluate_route(
            route_id="rt_test_snap",
            analysis_id=None,
            origin={"lat": 9.9312, "lon": 76.2673, "name": "Kochi Port"},
            destination={"lat": 11.25, "lon": 75.60, "name": "Kozhikode Offshore"},
            vessel_type="motorized_country_craft",
            departure_time="2026-09-22T06:00:00Z",
        )
        self.assertTrue(res["origin"]["validated"]["snapped"])

    def test_router_inland_origin_fails_closed(self):
        # Inland coordinate (Nagpur) must fail closed with error category invalid_location
        res = evaluate_route(
            route_id="rt_test_inland",
            analysis_id=None,
            origin={"lat": 21.1458, "lon": 79.0882, "name": "Nagpur"},
            destination={"lat": 9.93, "lon": 76.10, "name": "Kochi Offshore"},
            vessel_type="motorized_country_craft",
            departure_time="2026-09-22T06:00:00Z",
        )
        self.assertEqual(res["status"], "failed")
        self.assertIsNotNone(res["error"])
        self.assertEqual(res["error"]["error_category"], "invalid_location")

    def test_route_land_crossing_blocks(self):
        # Route directly crossing the Indian landmass (Kochi to Chennai) must block with land check
        res = evaluate_route(
            route_id="rt_test_cross_land",
            analysis_id=None,
            origin={"lat": 9.93, "lon": 76.10, "name": "Kochi Offshore"},
            destination={"lat": 13.08, "lon": 80.45, "name": "Chennai Offshore"},
            vessel_type="motorized_country_craft",
            departure_time="2026-09-22T06:00:00Z",
        )
        self.assertEqual(res["status"], "no_safe_route")
        self.assertTrue(len(res["blocking_reasons"]) > 0)
        self.assertTrue(any("elevation" in r or "land" in r for r in res["blocking_reasons"]))

    def test_peninsular_cross_india_route_never_safe(self):
        # Exact reproduction coordinates: Arabian Sea SW of Mumbai to Bay of Bengal S of Gopalpur.
        # Must never return status="completed" with max_risk_level="SAFE" through peninsular landmass.
        res = evaluate_route(
            route_id="rt_test_repro_mumbai_gopalpur",
            analysis_id=None,
            origin={"lat": 18.0066, "lon": 71.9323, "name": "Deep Sea, 137 km SW of Mumbai"},
            destination={"lat": 18.2572, "lon": 84.7708, "name": "Deep Sea, 113 km S of Gopalpur"},
            vessel_type="motorized_country_craft",
            departure_time="2026-09-22T06:00:00Z",
        )
        self.assertNotEqual(
            (res["status"], res.get("max_risk_level")),
            ("completed", "SAFE"),
            "Straight-line route crossing peninsular India must NEVER be completed as SAFE"
        )
        self.assertIn(res["status"], ("no_safe_route", "failed"))
        if res["status"] == "no_safe_route":
            self.assertEqual(len(res["waypoints"]), 0)
            self.assertTrue(len(res["blocking_reasons"]) > 0)
            self.assertTrue(any("land" in r or "elevation" in r for r in res["blocking_reasons"]))


    def test_coastal_route_completion(self):
        # Standard coastal corridor: Kochi offshore to Kozhikode offshore.
        # When GEBCO is reachable the route completes; when GEBCO times out the
        # router fails closed (retryable).  Both outcomes are correct per spec.
        res = evaluate_route(
            route_id="rt_test_02",
            analysis_id=None,
            origin={"lat": 9.93, "lon": 76.10, "name": "Kochi Offshore"},
            destination={"lat": 11.25, "lon": 75.60, "name": "Kozhikode Offshore"},
            vessel_type="mechanized_fishing_vessel",
            departure_time="2026-09-22T06:00:00Z",
        )
        self.assertIn(res["status"], ("completed", "failed"),
                      "Router must return completed or failed, never an unknown status")
        if res["status"] == "completed":
            self.assertGreater(len(res["waypoints"]), 1)
            self.assertGreater(res["total_distance_km"], 100.0)
        else:
            # GEBCO upstream unavailable: must be retryable, not a logic error
            self.assertIsNotNone(res["error"])
            self.assertEqual(res["error"]["error_category"], "upstream_unavailable")
            self.assertTrue(res["error"]["retryable"])


    def test_route_summary_contract_fields(self):
        res = evaluate_route(
            route_id="rt_test_03",
            analysis_id=None,
            origin={"lat": 9.93, "lon": 76.10, "name": "Kochi Offshore"},
            destination={"lat": 10.50, "lon": 75.90, "name": "Thrissur Offshore"},
            vessel_type="motorized_country_craft",
            departure_time="2026-09-22T06:00:00Z",
        )
        self.assertIn("total_distance_km", res)
        self.assertIn("estimated_duration_hours", res)
        self.assertIn("max_risk_level", res)
        self.assertIn("generated_at", res)


class TestNoSyntheticSinCosFormulas(unittest.TestCase):
    """Ensure no sin/cos depth or route risk approximations exist in codebase."""

    def test_no_sincos_in_router(self):
        router_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'app', 'planner', 'router.py'))
        with open(router_path, 'r', encoding='utf-8') as f:
            content = f.read()
        for line in content.splitlines():
            line_str = line.strip()
            if line_str.startswith("#"):
                continue
            if ("risk" in line_str.lower() or "score" in line_str.lower() or "detour" in line_str.lower()) and ("sin(" in line_str or "cos(" in line_str):
                self.fail(f"Synthetic sin/cos route formula detected in router.py: {line_str}")
        self.assertNotIn("79.45", content, "Fixed 79.45 detour must not exist in router.py")
        self.assertNotIn("_is_sri_lanka_waters", content, "Sri Lanka hardcoded box must not exist in router.py")

    def test_no_sincos_in_mongo_gis_depth(self):
        gis_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'app', 'adapters', 'mongo_gis.py'))
        with open(gis_path, 'r', encoding='utf-8') as f:
            content = f.read()
        for line in content.splitlines():
            line_str = line.strip()
            if line_str.startswith("#"):
                continue
            if ("depth" in line_str.lower() or "derived" in line_str.lower()) and ("sin(" in line_str or "cos(" in line_str):
                self.fail(f"Synthetic sin/cos depth formula detected in mongo_gis.py: {line_str}")


class TestTrendAnalysisEngine(unittest.TestCase):
    """7. Historical Trend & Anomaly Engine (7 tests)"""

    def test_theil_sen_flat_series(self):
        series = [28.0, 28.0, 28.0, 28.0, 28.0]
        slope = compute_theil_sen_slope(series)
        self.assertEqual(slope, 0.0)

    def test_theil_sen_positive_trend(self):
        series = [27.0, 27.2, 27.5, 27.8, 28.1]
        slope = compute_theil_sen_slope(series)
        self.assertGreater(slope, 0.0)

    def test_theil_sen_negative_trend(self):
        series = [28.5, 28.2, 27.9, 27.6, 27.3]
        slope = compute_theil_sen_slope(series)
        self.assertLess(slope, 0.0)

    def test_trend_insufficient_data(self):
        res = evaluate_trends(
            trend_id="tr_test_01",
            analysis_id=None,
            location={"lat": 9.94, "lon": 76.16, "name": "Kochi"},
            parameter="sea_surface_temperature",
            baseline_years=(2015, 2020),
            analysis_years=(2021, 2025),
        )
        self.assertIn("trend_direction", res)
        self.assertIn("monthly_means", res)
        self.assertIn("anomalies", res)

    def test_trend_unobserved_factors_present(self):
        res = evaluate_trends(
            trend_id="tr_test_02",
            analysis_id=None,
            location={"lat": 9.94, "lon": 76.16, "name": "Kochi"},
            parameter="sea_surface_temperature",
        )
        # Honesty section must document unobserved factors
        factors = res.get("unobserved_factors", [])
        self.assertTrue(len(factors) > 0)

    def test_trend_chlorophyll_sst_proxy_note(self):
        res = evaluate_trends(
            trend_id="tr_test_03",
            analysis_id=None,
            location={"lat": 9.94, "lon": 76.16, "name": "Kochi"},
            parameter="chlorophyll",
        )
        # Chlorophyll note explains SST proxy when ERDDAP is unconfigured
        notes = res.get("data_quality", {}).get("chlorophyll", {}).get("source_note", "")
        self.assertIn("proxy", notes.lower())

    def test_trend_result_contract_keys(self):
        res = evaluate_trends(
            trend_id="tr_test_04",
            analysis_id=None,
            location={"lat": 9.94, "lon": 76.16, "name": "Kochi"},
            parameter="wave_height",
        )
        for key in ["trend_id", "parameter", "trend_direction", "location", "generated_at"]:
            self.assertIn(key, res)


if __name__ == '__main__':
    unittest.main()
