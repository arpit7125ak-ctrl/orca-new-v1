import requests
import json

resp = requests.post("http://localhost:4000/api/v1/geofence/check", json={"lat": 9.10, "lon": 79.55})
print(f"HTTP Status: {resp.status_code}")
print(json.dumps(resp.json(), indent=2))
