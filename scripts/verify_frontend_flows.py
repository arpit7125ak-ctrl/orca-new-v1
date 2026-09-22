"""
scripts/verify_frontend_flows.py

Verifies all 6 UI flows through the frontend proxy at http://localhost:5173:
Flow 1: Home / Ask ORCA (GET / and config)
Flow 2: Point Safety Advisory (POST /api/v1/analysis)
Flow 3: Route Planner (POST /api/v1/route)
Flow 4: Geofence Sentinel (POST /api/v1/geofence/check)
Flow 5: Proactive Alerts Subscription (POST /api/v1/alerts/subscriptions)
Flow 6: Historical Climate Trends (POST /api/v1/trend)
"""

import json
import urllib.request
import urllib.error

BASE = "http://localhost:5173"


def get(path):
    req = urllib.request.Request(f"{BASE}{path}", headers={"User-Agent": "ORCA-Browser-Walkthrough"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.status, resp.read().decode("utf-8")


def post(path, body):
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "ORCA-Browser-Walkthrough"},
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))


print("================================================================================")
print("=== FLOW 1: HOME / ASK ORCA UI (HTML & System Config) ===")
print("================================================================================")
st1, html = get("/")
has_root = '<div id="root">' in html
print(f"GET / -> HTTP {st1} (HTML size: {len(html)} bytes, has root div: {has_root})")
st_cfg, cfg = get("/api/v1/config")
cfg_json = json.loads(cfg)
cfg_data = cfg_json.get('data', {})
print(f"GET /api/v1/config -> HTTP {st_cfg} | Activities: {len(cfg_data.get('activities', []))} | Vessel Types: {len(cfg_data.get('vessel_types', []))} | Languages: {len(cfg_data.get('languages', []))}")


print("\n================================================================================")
print("=== FLOW 2: POINT SAFETY ADVISORY UI FLOW (Kochi Point Analysis) ===")
print("================================================================================")
st2, res2 = post("/api/v1/analysis", {
    "place_name": "Kochi",
    "activity": "fishing",
    "vessel_type": "motorized_country_craft",
    "query": "Is it safe to fish offshore Kochi today?"
})
print(f"POST /api/v1/analysis -> HTTP {st2}")
print("Response:", json.dumps(res2, indent=2))


print("\n================================================================================")
print("=== FLOW 3: ROUTE PLANNER UI FLOW (Kochi -> Mangalore Corridor) ===")
print("================================================================================")
st3, res3 = post("/api/v1/route", {
    "origin": {"place_name": "Kochi", "coordinate": {"lat": 9.9312, "lon": 76.2673}},
    "destination": {"place_name": "Mangalore", "coordinate": {"lat": 12.9141, "lon": 74.8560}},
    "vessel_type": "motorized_country_craft",
    "departure_time": "2026-09-22T06:00:00Z"
})
print(f"POST /api/v1/route -> HTTP {st3}")
print("Response:", json.dumps(res3, indent=2))


print("\n================================================================================")
print("=== FLOW 4: GEOFENCE SENTINEL UI FLOW (Palk Strait Boundary Check) ===")
print("================================================================================")
st4, res4 = post("/api/v1/geofence/check", {
    "lat": 9.10,
    "lon": 79.55
})
print(f"POST /api/v1/geofence/check -> HTTP {st4}")
print("Response:", json.dumps(res4, indent=2))


print("\n================================================================================")
print("=== FLOW 5: PROACTIVE ALERTS SUBSCRIPTION UI FLOW ===")
print("================================================================================")
import time

sub_id = f"sub_ui_flow_{int(time.time())}"
st5, res5 = post("/api/v1/alerts/subscriptions", {
    "subscriber_id": sub_id,
    "channel": "web_push",
    "location": {"place_name": "Kasimedu", "coordinate": {"lat": 13.13, "lon": 80.30}},
    "alert_types": ["high_wave", "strong_wind", "cyclone"],
    "minimum_level": "CAUTION"
})
print(f"POST /api/v1/alerts/subscriptions -> HTTP {st5}")
print("Response:", json.dumps(res5, indent=2))
# Clean up
if st5 == 201 and "subscription_id" in res5:
    del_req = urllib.request.Request(
        f"{BASE}/api/v1/alerts/subscriptions/{res5['subscription_id']}",
        headers={"User-Agent": "ORCA-Browser-Walkthrough"},
        method="DELETE"
    )
    try:
        with urllib.request.urlopen(del_req) as del_resp:
            print(f"DELETE /api/v1/alerts/subscriptions/{res5['subscription_id']} -> HTTP {del_resp.status}")
    except Exception as e:
        print(f"Cleanup error: {e}")


print("\n================================================================================")
print("=== FLOW 6: HISTORICAL CLIMATE TRENDS UI FLOW (Kochi SST Trend) ===")
print("================================================================================")
st6, res6 = post("/api/v1/trend", {
    "place_name": "Kochi",
    "coordinate": {"lat": 9.94, "lon": 76.16},
    "parameter": "sea_surface_temperature"
})
print(f"POST /api/v1/trend -> HTTP {st6}")
print("Response snippet:")
res6_clean = {k: v for k, v in res6.items() if k not in ["monthly_means", "anomalies"]}
print(json.dumps(res6_clean, indent=2))
