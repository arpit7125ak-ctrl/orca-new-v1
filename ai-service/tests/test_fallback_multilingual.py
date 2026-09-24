"""
tests/test_fallback_multilingual.py

Verify that risk_agent and fallback_strings respect all 10 supported languages
when deterministic fallbacks are triggered.
"""

import pytest
from app.decision.fallback_strings import (
    get_fallback_reasoning,
    get_fallback_findings,
    get_fallback_incomplete_warning,
    get_fallback_one_line,
    get_zone_category_label,
    get_constraint_type_label,
    get_zone_name_label,
    sanitize_user_facing_text,
    _SUPPORTED,
)

LANGUAGES = ["en", "hi", "bn", "ta", "te", "or", "mr", "ml", "kn", "gu"]


def test_all_10_languages_supported():
    assert set(LANGUAGES) == _SUPPORTED


@pytest.mark.parametrize("lang", LANGUAGES)
def test_fallback_incomplete_warning_multilingual(lang):
    warning = get_fallback_incomplete_warning(language=lang)
    assert isinstance(warning, str)
    assert len(warning) > 10
    if lang == "en":
        assert "Wave or wind observations incomplete" in warning
    elif lang == "hi":
        assert "लहर या हवा के अवलोकन" in warning
    elif lang == "ta":
        assert "அலை அல்லது காற்று" in warning


@pytest.mark.parametrize("lang", LANGUAGES)
def test_fallback_reasoning_official_warning_multilingual(lang):
    base = {
        "baseline_score": 85,
        "contributing": {"wave_height_m": 85},
        "risk_factors": ["wave_height_m"],
        "scoreable_count": 1,
    }
    measurements = {
        "wave_height_m": {"value": 3.5, "unit": "m", "status": "available"}
    }
    official_warnings = [{
        "issuing_authority": "IMD",
        "bulletin_id": "BUL-001",
        "warning_type": "cyclone warning",
        "floor_level": "DANGEROUS",
        "floor_score": 85,
    }]

    text = get_fallback_reasoning(
        base=base,
        measurements=measurements,
        final_score=85,
        official_warnings=official_warnings,
        hard_rules=None,
        language=lang,
    )
    assert isinstance(text, str)
    assert "IMD" in text
    assert "BUL-001" in text
    assert "85" in text


@pytest.mark.parametrize("lang", LANGUAGES)
def test_fallback_reasoning_hard_rule_multilingual(lang):
    base = {
        "baseline_score": 85,
        "contributing": {"wave_height_m": 85},
        "risk_factors": ["wave_height_m"],
        "scoreable_count": 1,
    }
    measurements = {
        "wave_height_m": {"value": 3.2, "unit": "m", "status": "available"}
    }
    hard_rules = [{
        "rule_id": "HR_WAVE_3M",
        "description": "Wave height >= 3m",
        "floor_score": 85,
    }]

    text = get_fallback_reasoning(
        base=base,
        measurements=measurements,
        final_score=85,
        official_warnings=None,
        hard_rules=hard_rules,
        language=lang,
    )
    assert isinstance(text, str)
    assert "HR_WAVE_3M" in text
    assert "85" in text


@pytest.mark.parametrize("lang", LANGUAGES)
def test_fallback_findings_multilingual(lang):
    base = {
        "baseline_score": 50,
        "contributing": {"wind_speed_ms": 50},
        "risk_factors": ["wind_speed_ms"],
        "scoreable_count": 1,
    }
    measurements = {
        "wind_speed_ms": {"value": 12.0, "unit": "m/s", "status": "available"},
        "visibility_km": {"status": "missing"},
    }
    agents_missing = [{"agent": "weather", "status": "failed"}]

    findings = get_fallback_findings(
        base=base,
        measurements=measurements,
        agents_missing=agents_missing,
        language=lang,
    )
    assert isinstance(findings, list)
    assert len(findings) >= 2


def test_assess_points_offline_respects_language():
    import asyncio
    from app.risk import risk_agent

    async def _run():
        points = [{"point_id": "P0"}]
        merged_points = {
            "P0": {
                "measurements": {
                    "wave_height_m": {"value": 1.2, "unit": "m", "status": "available"},
                    "wind_speed_ms": {"value": 8.0, "unit": "m/s", "status": "available"},
                }
            }
        }
        
        # Assess in Tamil with LLM disabled/fallback
        assessments_ta = await risk_agent.assess_points(
            points=points,
            merged_points=merged_points,
            agents_missing=[],
            vessel_type="motorized",
            activity="fishing",
            response_language="ta",
        )
        assert len(assessments_ta) == 1
        res_ta = assessments_ta[0]
        assert res_ta["point_id"] == "P0"
        assert isinstance(res_ta["reasoning"], str)
        assert isinstance(res_ta["key_findings"], list)

    asyncio.run(_run())


@pytest.mark.parametrize("lang", ["hi", "bn", "ta", "te", "or", "mr", "ml", "kn", "gu"])
def test_parameter_names_translated_in_indic(lang):
    base = {
        "baseline_score": 52,
        "contributing": {"wind_gust_ms": 52, "wave_height_m": 45, "visibility_km": 40},
        "risk_factors": ["wind_gust_ms", "wave_height_m", "visibility_km"],
        "scoreable_count": 3,
    }
    measurements = {
        "wind_gust_ms": {"value": 10.4, "unit": "m/s", "status": "available"},
        "wave_height_m": {"value": 0.92, "unit": "m", "status": "available"},
        "visibility_km": {"value": 5.56, "unit": "km", "status": "available"},
        "precipitation_mm": {"status": "missing"},
    }
    reasoning = get_fallback_reasoning(
        base=base,
        measurements=measurements,
        final_score=52,
        official_warnings=None,
        hard_rules=None,
        language=lang,
    )
    # Check no raw parameter names with underscores or trailing suffixes appear
    assert "wind_gust_ms" not in reasoning
    assert "wave_height_m" not in reasoning
    assert "visibility_km" not in reasoning
    assert "wind gust ms" not in reasoning
    assert "wave height m" not in reasoning
    assert "visibility km" not in reasoning
    assert " at " not in reasoning

    findings = get_fallback_findings(
        base=base,
        measurements=measurements,
        agents_missing=[],
        language=lang,
    )
    combined = " ".join(findings)
    assert "wind_gust_ms" not in combined
    assert "wave_height_m" not in combined
    assert "precipitation_mm" not in combined
    assert "wind gust ms" not in combined


@pytest.mark.parametrize("lang", ["hi", "bn", "ta", "te", "or", "mr", "ml", "kn", "gu"])
def test_gis_zone_names_and_categories_translated_in_indic(lang):
    # 1. Zone category label must be localized and contain no raw snake_case
    cat = get_zone_category_label("seasonal_fishing_ban_area", lang)
    assert cat and len(cat) > 0
    assert cat != "seasonal_fishing_ban_area"
    assert "seasonal_fishing_ban_area" not in cat
    assert "_" not in cat

    # 2. Constraint type must be localized
    c_type = get_constraint_type_label("prohibited", lang)
    assert c_type and len(c_type) > 0
    assert c_type != "prohibited"

    # 3. Zone name must not contain untranslated English "Ban Area" or "Fishing Ban Area"
    z_name = get_zone_name_label("West Coast Annual Monsoon Fishing Ban Area", lang)
    assert "Ban Area" not in z_name
    assert "Fishing Ban Area" not in z_name

    # 4. Fallback findings with GIS fields must never contain raw enum or debug syntax
    base = {
        "baseline_score": 85,
        "contributing": {"zone_category": 85},
        "risk_factors": ["zone_category", "constraint_type", "zone_name"],
        "scoreable_count": 3,
    }
    measurements = {
        "zone_category": {"value": "seasonal_fishing_ban_area", "status": "available"},
        "constraint_type": {"value": "prohibited", "status": "available"},
        "zone_name": {"value": "West Coast Annual Monsoon Fishing Ban Area", "status": "available"},
        "inside_prohibited_zone": {"value": True, "status": "available"},
    }
    findings = get_fallback_findings(base, measurements, agents_missing=[], language=lang)
    combined = " ".join(findings)

    assert "(zone_category" not in combined
    assert "zone_category =" not in combined
    assert "seasonal_fishing_ban_area" not in combined
    assert "Ban Area" not in combined
    assert "Fishing Ban Area" not in combined


def test_sanitize_user_facing_text_strips_debug_and_translates_gis():
    defect = "वेस्ट कोस्ट एनुअल मानसून फिशिंग Ban Area में स्थित है (zone_category = seasonal_fishing_ban_area)।"
    fixed = sanitize_user_facing_text(defect, "hi")

    assert "(zone_category" not in fixed
    assert "seasonal_fishing_ban_area" not in fixed
    assert "Ban Area" not in fixed
    assert "प्रतिबंध क्षेत्र" in fixed

