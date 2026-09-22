"""
tests/test_imd_cyclone.py

Unit tests for IMD/NDMA SACHET Cyclone and Official Marine Warning Adapter:
1. Effective start/end time parsing (IST format 'Mon Sep 21 23:25:00 IST 2026')
2. Overlapping alert window check (Spec 49.1) with expired and future alert
3. Warning level grading strictly from severity_color (red -> DANGEROUS, orange -> UNSAFE, yellow -> CAUTION)
4. SACHET unreachable + no fresh cache -> status='missing'
"""

from datetime import datetime, timezone, timedelta
import pytest

from app.adapters.imd_cyclone import (
    parse_sachet_time,
    is_alert_window_overlapping,
    grade_severity_from_color,
    cyclone,
)
from app.config.settings import settings


def test_parse_sachet_time():
    """Test parsing of IST format 'Mon Sep 21 23:25:00 IST 2026'."""
    t_str = "Mon Sep 21 23:25:00 IST 2026"
    dt = parse_sachet_time(t_str)
    assert dt is not None
    # 23:25:00 IST = 17:55:00 UTC
    assert dt.hour == 17
    assert dt.minute == 55
    assert dt.year == 2026
    assert dt.tzinfo == timezone.utc


def test_overlapping_alert_window():
    """Test overlapping window logic (Spec 49.1)."""
    win_start = datetime(2026, 9, 21, 10, 0, tzinfo=timezone.utc)
    win_end = datetime(2026, 9, 21, 16, 0, tzinfo=timezone.utc)

    # 1. Overlapping alert: 08:00 to 12:00 UTC (overlaps 10:00 to 16:00)
    # In IST: 13:30 to 17:30 IST
    eff_start = "Mon Sep 21 13:30:00 IST 2026"
    eff_end = "Mon Sep 21 17:30:00 IST 2026"
    assert is_alert_window_overlapping(eff_start, eff_end, win_start, win_end) is True

    # 2. Expired alert: ended before window start (06:00 to 09:00 UTC)
    # In IST: 11:30 to 14:30 IST (09:00 UTC)
    eff_start_exp = "Mon Sep 21 11:30:00 IST 2026"
    eff_end_exp = "Mon Sep 21 14:30:00 IST 2026"  # 09:00 UTC <= 10:00 UTC
    assert is_alert_window_overlapping(eff_start_exp, eff_end_exp, win_start, win_end) is False

    # 3. Distant future alert: starts after window end (18:00 to 22:00 UTC)
    # In IST: 23:30 IST
    eff_start_fut = "Mon Sep 21 23:30:00 IST 2026"  # 18:00 UTC >= 16:00 UTC
    eff_end_fut = "Tue Sep 22 03:30:00 IST 2026"
    assert is_alert_window_overlapping(eff_start_fut, eff_end_fut, win_start, win_end) is False


def test_severity_grading_from_color():
    """Test warning level grading strictly from severity_color."""
    assert grade_severity_from_color("Red") == "DANGEROUS"
    assert grade_severity_from_color("RED") == "DANGEROUS"
    assert grade_severity_from_color("Orange") == "UNSAFE"
    assert grade_severity_from_color("Yellow") == "CAUTION"
    assert grade_severity_from_color("Amber") == "CAUTION"


def test_sachet_unreachable_missing_status(monkeypatch):
    """Test that when SACHET gateway is unreachable and no fresh cache exists, status is 'missing'."""
    import app.adapters.imd_cyclone as imd_mod

    # Clear cache and point to dead URL
    monkeypatch.setattr(imd_mod, "_alerts_cache", None)
    monkeypatch.setattr(imd_mod, "_alerts_cache_timestamp", 0.0)
    monkeypatch.setattr(imd_mod, "SACHET_ALERTS_URL", "http://127.0.0.1:59999/dead")
    monkeypatch.setattr(imd_mod, "_check_open_meteo_cyclonic_physics", lambda lat, lon: None)

    res = imd_mod.cyclone(9.94, 76.16, "2026-09-21T06:00:00Z/2026-09-21T12:00:00Z")
    assert "official_warning_active" in res
    m = res["official_warning_active"]
    assert m["status"] == "missing"
    assert m["value"] is None
    assert m["source"] is None
    assert m["product_id"] is None
    assert m["confidence"] is None
