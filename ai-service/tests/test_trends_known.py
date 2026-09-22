"""
tests/test_trends_known.py

Unit tests for Trend & Oceanographic Anomaly Engine with known answers:
1. +0.3 C/yr synthetic series (24 months: month 0..23 = 28.0 + 0.3*(m/12)) -> direction increasing, magnitude approx 0.30/yr, p < 0.05
2. Flat control (28.0 for 24 months) -> direction stable, magnitude 0.0, p >= 0.10
3. One single month +3 C in 24 months -> direction stable (Theil-Sen is robust to single outliers)
4. 14-month series -> direction insufficient_data, magnitude null, p null, confidence <= 0.3
"""

import pytest
from app.risk.trends import evaluate_trends, compute_theil_sen_slope, compute_mann_kendall, deseasonalise_series


def test_synthetic_warming_trend():
    """Test 1: +0.3 C/yr synthetic series (24 months)."""
    series = [28.0 + 0.3 * (m / 12.0) for m in range(24)]
    res = evaluate_trends(
        trend_id="trend-known-1",
        location={"lat": 9.94, "lon": 76.16},
        parameter="sea_surface_temperature",
        raw_series_override=series,
    )
    assert res["trend_direction"] == "increasing"
    assert res["trend_magnitude"] is not None
    assert abs(res["trend_magnitude"] - 0.30) < 0.02
    assert res["parameter"] == "sea_surface_temperature"


def test_flat_control():
    """Test 2: Flat control (28.0 for 24 months)."""
    series = [28.0 for _ in range(24)]
    res = evaluate_trends(
        trend_id="trend-known-2",
        location={"lat": 9.94, "lon": 76.16},
        parameter="sea_surface_temperature",
        raw_series_override=series,
    )
    assert res["trend_direction"] == "stable"
    assert res["trend_magnitude"] == 0.0
    deseas = deseasonalise_series(series)
    tau, p = compute_mann_kendall(deseas)
    assert p >= 0.10


def test_single_month_outlier():
    """Test 3: One single month +3 C in 24 months (robust to single outlier)."""
    series = [28.0 for _ in range(24)]
    series[10] = 31.0  # +3 C outlier spike
    res = evaluate_trends(
        trend_id="trend-known-3",
        location={"lat": 9.94, "lon": 76.16},
        parameter="sea_surface_temperature",
        raw_series_override=series,
    )
    assert res["trend_direction"] == "stable"
    assert res["trend_magnitude"] == 0.0


def test_insufficient_data_short_series():
    """Test 4: 14-month series (< 24 months)."""
    series = [28.0 + 0.3 * (m / 12.0) for m in range(14)]
    res = evaluate_trends(
        trend_id="trend-known-4",
        location={"lat": 9.94, "lon": 76.16},
        parameter="sea_surface_temperature",
        raw_series_override=series,
    )
    assert res["trend_direction"] == "insufficient_data"
    assert res["trend_magnitude"] is None
    assert res["confidence"] <= 0.3
