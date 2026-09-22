# ORCA Maritime Safety Platform — GIS Data & Boundary Integrity Guide

## 1. Overview and Core Philosophy

In maritime operations, navigational boundaries are matters of life and death. A vessel crossing into an International Maritime Boundary Line (IMBL) or a prohibited Marine Protected Area faces arrest, vessel impoundment, or live-fire enforcement.

ORCA strictly enforces the **Zero Fabrication Rule** regarding maritime geometry:
1. **Never mark hand-drawn or approximate geometry as authoritative.**
2. **Bundled starter boundaries are explicitly designated as `verification: "approximate"`** with visible UI indicators `(approximate boundary, unverified)`.
3. **Only official GeoJSON ingested via `backend/scripts/import-gis-geojson.js`** with verified source URLs, recognized open licenses, and passing automated landmark sanity checks may be stored with `verification: "authoritative"`.

---

## 2. Ingestion Pipeline: `import-gis-geojson.js`

To promote a GIS layer to authoritative status, use the CLI ingestion script:

```bash
node backend/scripts/import-gis-geojson.js \
  --file /path/to/official-boundary.geojson \
  --layer-name "India Exclusive Economic Zone" \
  --layer-type international_border \
  --constraint-type warning_only \
  --source-url "https://marineregions.org/gazetteer.php?p=details&id=8480" \
  --license "CC-BY 4.0"
```

### Required CLI Flags
| Flag | Description | Examples |
|---|---|---|
| `--file` | Path to valid GeoJSON file containing Polygon or MultiPolygon | `./data/eez.geojson` |
| `--layer-name` | Unique descriptive human name | `"Gulf of Mannar Marine National Park"` |
| `--layer-type` | Domain category | `international_border`, `marine_protected_area`, `military_exercise_zone`, `pipeline_corridor`, `port_limits` |
| `--constraint-type` | Operational effect | `prohibited` (no entry), `conditional` (vessel/season permits), `warning_only` (jurisdiction change) |
| `--source-url` | Verifiable institutional HTTP(S) URL | `https://marineregions.org/...` or `https://protectedplanet.net/...` |
| `--license` | Permissible distribution license | `CC-BY 4.0`, `ODbL`, `Government Open Data License` |

### Automated Sanity Checks
The script validates:
1. **RFC 7946 GeoJSON compliance**: Features must be `Polygon` or `MultiPolygon`.
2. **Coordinate range**: Longitudes in `[-180, 180]`, Latitudes in `[-90, 90]`.
3. **Indian Maritime Domain bounding box**: Features must intersect the Indian Ocean operational envelope ($4^\circ\text{N}$ to $38^\circ\text{N}$, $65^\circ\text{E}$ to $98^\circ\text{E}$).
4. **Institutional Source URL**: Rejects empty, local, or unvetted URLs.

---

## 3. Bundled vs. Authoritative Boundaries

| Boundary Layer | Status | Source | Verification | Operational Behavior |
|---|---|---|---|---|
| **Indian EEZ** | Bundled / Approximate | Marine Regions v11 (simplified) | `approximate` | Warning when vessel exits 200 NM sovereign waters. |
| **Gahirmatha Marine Sanctuary** | Bundled / Approximate | Odisha Forest Dept Gazette | `approximate` | Seasonal prohibition (Nov 1 – May 31) for sea turtle breeding. |
| **Gulf of Mannar Biosphere** | Bundled / Approximate | WDPA / UNESCO MAB | `approximate` | Prohibited artisanal/trawl access in core national park islands. |
| **Mumbai High Offshore Exclusion** | Bundled / Approximate | ONGC Safety Zone | `approximate` | 500m safety exclusion around active petroleum platforms. |
| **Palk Bay / Sri Lanka IMBL** | Inactive / Gated | Bilateral Agreements 1974/1976 | `disabled` | Routing across Palk Strait disabled pending survey coordinates. |

---

## 4. Special Note: Palk Bay & Gulf of Mannar Routing Sector

Under Section 71 of the ORCA Architecture Specification:
- Automatic maritime routing through the narrow Palk Strait and Gulf of Mannar bilateral sector is **intentionally disabled**.
- **Reason**: The 1974 and 1976 Indo-Sri Lankan maritime boundary agreements define specific turning points with high political sensitivity. Because fishing craft navigating this corridor without real-time AIS/VMS are prone to accidental drift across the IMBL, ORCA refuses to generate automated waypoint paths through this sector until an operator loads verified, hydrographically surveyed bilateral coordinates.
- **System Behavior**: When an origin or destination requires transiting this sector, the route engine returns HTTP 200 with status `no_safe_route` and displays the exact reason to the navigator.
