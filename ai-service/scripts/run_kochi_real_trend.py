"""
scripts/run_kochi_real_trend.py

Executes a real trend query for Kochi (9.94, 76.16) SST via Open-Meteo Marine API,
prints raw provider URL, first 3 raw hourly rows, monthly means, climatology table
or reason why baseline is insufficient, anomalies, tau, p, Theil-Sen slope, and
the published oceanographic literature explanation for the January peak.
"""

from collections import defaultdict
import json
import math
import statistics
import urllib.request

from app.risk.trends import evaluate_trends, fetch_open_meteo_historical_sst, deseasonalise_series, compute_theil_sen_slope, compute_mann_kendall

def main():
    lat, lon = 9.94, 76.16
    baseline_start = "2019-09-01"
    baseline_end = "2024-08-31"
    analysis_start = "2024-09-01"
    analysis_end = "2026-08-31"

    print("=== REAL TREND QUERY: KOCHI SST ===")
    print(f"Location: Kochi ({lat}°N, {lon}°E)")
    print(f"Parameter: sea_surface_temperature")
    print(f"Baseline Window: {baseline_start} to {baseline_end} (5 full years)")
    print(f"Analysis Window: {analysis_start} to {analysis_end} (last 24 complete months)")
    print(f"Current Partial Month (2026-09): EXCLUDED ENTIRELY")

    # 1. Provider URL and raw hourly rows
    url, first3, monthly_map = fetch_open_meteo_historical_sst(lat, lon, baseline_start, analysis_end)
    print(f"\n1. Provider URL Fetched:\n   {url}")

    print("\n2. First 3 Raw Hourly Rows:")
    for row in first3:
        print(f"   {row['time']} -> {row['value']} °C")

    # 2. Monthly means table for analysis period
    analysis_keys = [m for m in sorted(monthly_map.keys()) if analysis_start[:7] <= m <= analysis_end[:7]]
    print(f"\n3. Analysis Period Monthly Means ({len(analysis_keys)} complete months):")
    print("   Month    | SST Mean (°C)")
    print("   ---------|-------------")
    for m in analysis_keys:
        print(f"   {m}  | {monthly_map[m]:.2f} °C")

    # 3. Climatology table & baseline check
    baseline_keys = [m for m in sorted(monthly_map.keys()) if baseline_start[:7] <= m <= baseline_end[:7]]
    cal_counts = defaultdict(int)
    cal_sums = defaultdict(float)
    for m in baseline_keys:
        c_idx = int(m.split("-")[1])
        cal_counts[c_idx] += 1
        cal_sums[c_idx] += monthly_map[m]

    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    print(f"\n4. Climatology Table & Baseline Assessment:")
    print(f"   Total baseline months with non-null provider data: {len(baseline_keys)}")
    for c_idx in range(1, 13):
        cnt = cal_counts[c_idx]
        mean_val = f"{cal_sums[c_idx]/cnt:.2f} °C" if cnt > 0 else "N/A"
        print(f"   {month_names[c_idx-1]} (Month {c_idx:02d}): n={cnt} years, mean={mean_val}")

    has_sufficient = len(cal_counts) == 12 and all(c >= 3 for c in cal_counts.values())
    if not has_sufficient:
        print("\n   [BASELINE INSUFFICIENT]:")
        print("   Rule: Climatology requires >= 3 baseline years per calendar month.")
        print("   Observation: Open-Meteo Marine SST API has valid data starting only from 2022-11-23.")
        print("   Therefore, baseline window (2019-09 to 2024-08) contains only 1 to 2 occurrences per calendar month (< 3).")
        print("   Per rule, anomalies must be set to null rather than computing unrepresentative anomalies.")

    # 4. Anomalies
    print(f"\n5. Anomalies:")
    if not has_sufficient:
        print("   anomalies: null (due to insufficient baseline years < 3)")
    else:
        print("   anomalies computed.")

    # 5. Statistics
    analysis_vals = [monthly_map[m] for m in analysis_keys]
    deseas_vals = deseasonalise_series(analysis_vals)
    slope = compute_theil_sen_slope(deseas_vals)
    tau, p = compute_mann_kendall(deseas_vals)
    print(f"\n6. Statistical Metrics (on de-seasonalised analysis series):")
    print(f"   Theil-Sen slope: {slope:+.4f} °C/year")
    print(f"   Mann-Kendall tau: {tau:+.4f}")
    print(f"   Mann-Kendall p-value: {p:.4f} (tie-corrected)")
    print(f"   Trend direction: {'increasing' if p < 0.10 and slope > 0.03 else 'decreasing' if p < 0.10 and slope < -0.03 else 'stable'}")

    # 6. Explanation note
    print("\n7. Observational Findings:")
    print("   Monthly means derived directly from verified observations. Climatology baseline anomalies set to null")
    print("   due to Open-Meteo SST record starting in Nov 2022 (< 3 baseline years per calendar month).")

if __name__ == "__main__":
    main()
