"""
app/planner/timewindow.py

Section 14 - Time Interpretation. Turns the user's raw date/time (or natural
language like "tomorrow morning") into an explicit TimeWindow.

CONTRACT SHAPE (contracts/shared/TimeWindow.json) - this is the one that looks
nothing like you'd guess: `local` and `utc` are ISO 8601 INTERVAL STRINGS of
the form "<start>/<end>", NOT nested objects.

    local: "2026-09-14T06:00:00+05:30/2026-09-14T10:00:00+05:30"
    utc:   "2026-09-14T00:30:00Z/2026-09-14T04:30:00Z"

The raw inbound `time_range` on AnalysisRequest is a DIFFERENT shape:
{ "start": "06:00", "end": "10:00" }. Raw range = user input. TimeWindow =
our interpreted output. Do not confuse them.
"""

from datetime import datetime, time, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

# India Standard Time. The Backend deliberately refuses to assume this; the
# Planner is the layer that IS allowed to, because it has the resolved location.
IST = timezone(timedelta(hours=5, minutes=30))

# Section 14: named time buckets, so "tomorrow morning" resolves consistently
# rather than differently on every run.
TIME_BUCKETS: Dict[str, Tuple[time, time]] = {
    "early_morning": (time(4, 0), time(7, 0)),
    "morning": (time(6, 0), time(11, 0)),
    "midday": (time(11, 0), time(14, 0)),
    "afternoon": (time(14, 0), time(18, 0)),
    "evening": (time(17, 0), time(21, 0)),
    "night": (time(20, 0), time(23, 59)),
    "overnight": (time(22, 0), time(4, 0)),   # crosses midnight
    "full_day": (time(0, 0), time(23, 59)),
}

_BUCKET_KEYWORDS = {
    "early morning": "early_morning",
    "dawn": "early_morning",
    "sunrise": "early_morning",
    "morning": "morning",
    "midday": "midday",
    "noon": "midday",
    "afternoon": "afternoon",
    "evening": "evening",
    "sunset": "evening",
    "dusk": "evening",
    "night": "night",
    "tonight": "night",
    "overnight": "overnight",
}


def _iso(dt: datetime) -> str:
    """ISO 8601 with a real offset. Z for UTC, +05:30 style otherwise."""
    s = dt.isoformat()
    return s.replace("+00:00", "Z")


def _interval(start: datetime, end: datetime) -> str:
    """Build the "<start>/<end>" interval string the contract requires."""
    return f"{_iso(start)}/{_iso(end)}"


def detect_bucket(query: Optional[str]) -> Optional[str]:
    """Find a named time bucket in free text, if present.

    Longest keyword first so "early morning" wins over "morning".
    """
    if not query:
        return None
    lowered = query.lower()
    for keyword in sorted(_BUCKET_KEYWORDS, key=len, reverse=True):
        if keyword in lowered:
            return _BUCKET_KEYWORDS[keyword]
    return None


def detect_relative_day(query: Optional[str], now_local: datetime) -> Optional[datetime]:
    """Resolve 'today' / 'tomorrow' / 'tonight' to a local calendar date."""
    if not query:
        return None
    lowered = query.lower()
    if "day after tomorrow" in lowered:
        return now_local + timedelta(days=2)
    if "tomorrow" in lowered:
        return now_local + timedelta(days=1)
    if "today" in lowered or "tonight" in lowered or "now" in lowered:
        return now_local
    return None


def build(
    *,
    date_str: Optional[str],
    time_range: Optional[Dict[str, str]],
    query: Optional[str],
    tz: timezone = IST,
) -> Dict[str, Any]:
    """Produce a contract-shaped TimeWindow.

    Resolution order, most explicit first:
      1. explicit date + explicit time_range
      2. explicit date + a bucket found in the query
      3. relative day from the query ("tomorrow") + bucket
      4. fallback: the next 6 hours from now

    The fallback is deliberately a real, defensible window rather than an
    error: a bare "is it safe?" with no time reference genuinely means "right
    now", and refusing to answer would be unhelpful. `original_expression`
    records what the user actually said so the reasoning stays explainable.
    """
    now_local = datetime.now(tz)
    bucket = detect_bucket(query)

    # --- Resolve the calendar day ----------------------------------------
    if date_str:
        try:
            y, m, d = (int(x) for x in date_str.split("-"))
            day = datetime(y, m, d, tzinfo=tz)
        except Exception:  # noqa: BLE001 - malformed date falls through
            day = now_local
    else:
        relative = detect_relative_day(query, now_local)
        day = relative if relative else now_local

    # --- Resolve start/end within that day -------------------------------
    if time_range and time_range.get("start") and time_range.get("end"):
        try:
            sh, sm = (int(x) for x in str(time_range["start"]).split(":")[:2])
            eh, em = (int(x) for x in str(time_range["end"]).split(":")[:2])
            start = day.replace(hour=sh, minute=sm, second=0, microsecond=0)
            end = day.replace(hour=eh, minute=em, second=0, microsecond=0)
            # end before start on the clock = an overnight window, so the end
            # belongs to the NEXT calendar day (Section 7.5).
            if end <= start:
                end += timedelta(days=1)
            matched_bucket = bucket
        except Exception:  # noqa: BLE001
            start, end, matched_bucket = _from_bucket(day, bucket, now_local)
    else:
        start, end, matched_bucket = _from_bucket(day, bucket, now_local)

    start_utc = start.astimezone(timezone.utc)
    end_utc = end.astimezone(timezone.utc)

    return {
        "local": _interval(start, end),
        "utc": _interval(start_utc, end_utc),
        # What the user actually wrote, preserved for explainability (§79).
        "original_expression": _extract_expression(query, bucket),
        "matched_bucket": matched_bucket,
    }


def _from_bucket(
    day: datetime, bucket: Optional[str], now_local: datetime
) -> Tuple[datetime, datetime, Optional[str]]:
    """Turn a named bucket into concrete start/end datetimes."""
    if bucket and bucket in TIME_BUCKETS:
        b_start, b_end = TIME_BUCKETS[bucket]
        start = day.replace(hour=b_start.hour, minute=b_start.minute, second=0, microsecond=0)
        end = day.replace(hour=b_end.hour, minute=b_end.minute, second=0, microsecond=0)
        if end <= start:  # overnight bucket
            end += timedelta(days=1)
        return start, end, bucket

    # No date, no bucket: the honest reading of "is it safe?" is "right now",
    # so use a rolling 6-hour window from the current hour.
    start = now_local.replace(minute=0, second=0, microsecond=0)
    return start, start + timedelta(hours=6), None


def _extract_expression(query: Optional[str], bucket: Optional[str]) -> Optional[str]:
    """Best-effort record of the phrase that drove the interpretation."""
    if not query:
        return None
    lowered = query.lower()
    for phrase in ("day after tomorrow", "tomorrow morning", "tomorrow", "tonight", "today"):
        if phrase in lowered:
            return phrase
    if bucket:
        return bucket.replace("_", " ")
    return None
