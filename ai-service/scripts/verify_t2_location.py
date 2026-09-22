import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.planner.location import resolve, check_gebco_elevation

print("=== T2 LOCATION AND SNAPPING VERIFICATION ===")

# 1. Kochi offshore sea coordinate (9.94, 76.16)
loc1, err1 = resolve(coordinate={"lat": 9.94, "lon": 76.16})
elev1, _ = check_gebco_elevation(9.94, 76.16)
print("1. Kochi Sea (9.94, 76.16):")
print(f"   GEBCO Elevation: {elev1} m (is sea: {elev1 < 0})")
print(f"   Error: {err1}")
print(f"   Validated lat/lon: {loc1['validated']['lat']}, {loc1['validated']['lon']}")
print(f"   Snapped: {loc1['validated']['snapped']} (kept as given: {loc1['validated']['snapped'] is False})")
print(f"   Snap Distance km: {loc1['validated']['snap_distance_km']}")

# 2. Kochi city center land point (9.9312, 76.2673)
loc2, err2 = resolve(coordinate={"lat": 9.9312, "lon": 76.2673})
elev2, _ = check_gebco_elevation(9.9312, 76.2673)
print("\n2. Kochi City Land Point (9.9312, 76.2673):")
print(f"   GEBCO Elevation: {elev2} m (is land: {elev2 >= 0})")
print(f"   Error: {err2}")
print(f"   Snapped: {loc2['validated']['snapped']}")
print(f"   Snap Distance km: {loc2['validated']['snap_distance_km']} km (<= 25 km: {loc2['validated']['snap_distance_km'] <= 25.0})")
print(f"   Snapped lat/lon: {loc2['validated']['lat']}, {loc2['validated']['lon']}")
print(f"   Snap Reference: {loc2['validated']['snap_reference']}")

# 3. Inland point Nagpur (21.1458, 79.0882) > 25km from sea
loc3, err3 = resolve(coordinate={"lat": 21.1458, "lon": 79.0882})
print("\n3. Deep Inland Point Nagpur (21.1458, 79.0882):")
print(f"   Location: {loc3}")
print(f"   Error Category: {err3} (canonical invalid_location: {err3 == 'invalid_location'})")

# 4. Dead GEBCO port fails closed
# We temporarily point the terrain endpoint in check_gebco_elevation to a dead port
import urllib.request
orig_opener = urllib.request.urlopen
def mock_dead_opener(*args, **kwargs):
    raise urllib.error.URLError("Connection refused on dead port 59999")
urllib.request.urlopen = mock_dead_opener
elev_err, err_code = check_gebco_elevation(9.94, 76.16)
urllib.request.urlopen = orig_opener

print("\n4. Dead GEBCO Port check (fail closed):")
print(f"   Elevation returned: {elev_err}")
print(f"   Error returned: {err_code} (upstream_unavailable: {err_code == 'upstream_unavailable'})")

# 5. Query without place
loc5, err5 = resolve(query="how high can waves get in a cyclone?")
print("\n5. Query Without Place ('how high can waves get in a cyclone?'):")
print(f"   Location: {loc5}")
print(f"   Error Category: {err5} (canonical invalid_location: {err5 == 'invalid_location'})")
print("===============================================")
