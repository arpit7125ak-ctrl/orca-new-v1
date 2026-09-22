"""
tests/test_offline_pipeline.py

Verifies T6 Offline and Unreachable Feed Invariants:
1. Real pipeline with network blocked/dead port -> measurements 'missing', risk not SAFE,
   rules include insufficient-evidence, confidence <= 0.5.
2. Second case: Open-Meteo works (calm) but SACHET unreachable -> risk >= CAUTION.
"""

import asyncio
import pytest
from app.risk.risk_agent import assess_points, _check_official_warnings, _check_hard_rules
from app.risk.baseline import compute_baseline
from app.adapters.open_meteo import weather, ocean
from app.adapters.imd_cyclone import cyclone


def test_offline_pipeline_dead_port(monkeypatch):
    """Case 1: All upstream providers blocked / dead port.

    Measurements must be 'missing', risk must NOT be SAFE, rules must include
    'insufficient_evidence', confidence <= 0.5.
    """
    async def _run():
        import app.adapters.open_meteo as om_mod
        import app.adapters.imd_cyclone as imd_mod

        # Point all upstream endpoints to an unroutable dead port
        dead_url = "http://127.0.0.1:59999/dead"
        monkeypatch.setattr(om_mod, "OPEN_METEO_WEATHER_URL", dead_url)
        monkeypatch.setattr(om_mod, "OPEN_METEO_MARINE_URL", dead_url)
        monkeypatch.setattr(imd_mod, "SACHET_ALERTS_URL", dead_url)
        monkeypatch.setattr(imd_mod, "_alerts_cache", None)
        monkeypatch.setattr(imd_mod, "_alerts_cache_timestamp", 0.0)
        monkeypatch.setattr(imd_mod, "_check_open_meteo_cyclonic_physics", lambda lat, lon: None)

        # Force live adapter mode
        monkeypatch.setattr(om_mod.settings, "ADAPTER_MODE", "live")

        # Fetch through live adapters
        w = om_mod.weather(9.94, 76.16, "2026-09-21T06:00:00Z/2026-09-21T12:00:00Z")
        o = om_mod.ocean(9.94, 76.16, "2026-09-21T06:00:00Z/2026-09-21T12:00:00Z")
        c = imd_mod.cyclone(9.94, 76.16, "2026-09-21T06:00:00Z/2026-09-21T12:00:00Z")

        merged_measurements = {}
        merged_measurements.update(w)
        merged_measurements.update(o)
        merged_measurements.update(c)

        # 1. Assert all measurements are honestly marked 'missing'
        for param, m in merged_measurements.items():
            assert m["status"] == "missing", f"Param {param} status is {m['status']}, expected 'missing'"
            assert m["value"] is None, f"Param {param} value is not None"
            assert m["source"] is None, f"Param {param} source is not None"

        # 2. Run risk assessment on this missing evidence
        points = [{"point_id": "P1", "lat": 9.94, "lon": 76.16}]
        merged_points = {"P1": {"measurements": merged_measurements}}

        assessments = await assess_points(
            points=points,
            merged_points=merged_points,
            agents_missing=[{"agent": "weather"}, {"agent": "ocean"}, {"agent": "cyclone"}],
            vessel_type="traditional_non_motorised",
            activity="fishing",
            response_language="en",
        )

        assert len(assessments) == 1
        assessment = assessments[0]

        # Invariant: Risk must NOT be SAFE
        assert assessment["risk_level"] != "SAFE"
        assert assessment["risk_level"] in ("CAUTION", "UNSAFE", "DANGEROUS")

        # Invariant: Rules include insufficient-evidence
        rule_ids = [r["rule_id"] for r in assessment.get("hard_rules_applied", [])]
        assert "insufficient_evidence" in rule_ids

        # Invariant: Confidence <= 0.5
        assert assessment["confidence"] is not None
        assert assessment["confidence"] <= 0.5

    asyncio.run(_run())


def test_calm_weather_sachet_unreachable(monkeypatch):
    """Case 2: Open-Meteo works (calm weather) but SACHET is unreachable.

    Even if weather/ocean are perfectly calm (SAFE baseline), unreachable official
    warnings must enforce a precautionary floor of CAUTION (risk >= CAUTION).
    """
    async def _run():
        # 1. Provide calm weather measurements (wind 2.0 m/s, wave 0.3 m)
        vt = "2026-09-21T06:00:00Z"
        calm_measurements = {
            "wind_speed_ms": {
                "parameter": "wind_speed_ms", "value": 2.0, "status": "available", "valid_time": vt
            },
            "wave_height_m": {
                "parameter": "wave_height_m", "value": 0.3, "status": "available", "valid_time": vt
            },
            # SACHET official warning unreachable -> status='missing'
            "official_warning_active": {
                "parameter": "official_warning_active", "value": None, "status": "missing", "valid_time": vt
            }
        }

        # Verify baseline in isolation is perfectly SAFE
        base = compute_baseline(measurements=calm_measurements, hourly_measurements=None, vessel_type="traditional_non_motorised")
        assert base["baseline_score"] < 35, f"Baseline {base['baseline_score']} not safe"

        # Assess points
        points = [{"point_id": "P1", "lat": 9.94, "lon": 76.16}]
        merged_points = {"P1": {"measurements": calm_measurements}}

        assessments = await assess_points(
            points=points,
            merged_points=merged_points,
            agents_missing=[{"agent": "cyclone"}],
            vessel_type="traditional_non_motorised",
            activity="fishing",
            response_language="en",
        )

        assert len(assessments) == 1
        assessment = assessments[0]

        # Invariant: Risk must be >= CAUTION (never SAFE)
        assert assessment["risk_level"] != "SAFE"
        assert assessment["risk_level"] in ("CAUTION", "UNSAFE", "DANGEROUS")
        assert assessment["final_score"] >= 45

        # Check official warnings floor is present
        warning_auths = [w["issuing_authority"] for w in assessment.get("official_warnings", [])]
        assert any("NDMA SACHET" in a for a in warning_auths)

    asyncio.run(_run())
