import urllib.request

url = "https://coastwatch.pfeg.noaa.gov/erddap/griddap/ncdcOisst21Agg_LonPM180.csv?sst[(2020-01-01T12:00:00Z):1:(2020-01-03T12:00:00Z)][(0.0):1:(0.0)][(9.875):1:(9.875)][(76.125):1:(76.125)]"
print("Fetching from:", url)
try:
    req = urllib.request.Request(url, headers={"User-Agent": "ORCA-Marine-Platform/1.0"})
    with urllib.request.urlopen(req, timeout=12) as resp:
        content = resp.read().decode("utf-8")
        print("Success! Response:")
        print(content)
except Exception as e:
    print("Failed:", e)
