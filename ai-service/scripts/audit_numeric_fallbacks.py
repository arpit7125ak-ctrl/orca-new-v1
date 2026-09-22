import re
import os

patterns = [
    (r"\?\?\s*\d+(?:\.\d+)?", "Nullish coalescing to numeric literal (?? <num>)"),
    (r"\|\|\s*\d+(?:\.\d+)?", "Logical OR to numeric literal (|| <num>)"),
    (r"\.get\([^)]+,\s*\d+(?:\.\d+)?\)", "Dictionary .get() with numeric fallback"),
]

def audit_directory(base_path, extensions):
    findings = []
    for root, _, files in os.walk(base_path):
        for f in files:
            if any(f.endswith(ext) for ext in extensions):
                fp = os.path.join(root, f)
                rel_path = os.path.relpath(fp, base_path)
                with open(fp, "r", encoding="utf-8", errors="ignore") as handle:
                    for line_num, line in enumerate(handle, 1):
                        stripped = line.strip()
                        for pat, desc in patterns:
                            if re.search(pat, stripped):
                                findings.append((rel_path, line_num, desc, stripped))
    return findings

print("================================================================================")
print("AUDIT: Numeric Literal Fallbacks in Adapters and Ingestion Modules")
print("================================================================================")

print("\n--- Scanning ai-service/app/adapters/ ---")
ai_findings = audit_directory("c:/Users/arpit/Desktop/main orca/orca new - Copy antg/orca/ai-service/app/adapters", [".py"])
if not ai_findings:
    print("Clean: 0 numeric literal fallbacks found in ai-service/app/adapters/")
else:
    for rel, ln, desc, text in ai_findings:
        print(f"  {rel}:{ln} [{desc}] -> {text}")

print("\n--- Scanning backend/src/modules/geofence/ and ingestion ---")
backend_findings = audit_directory("c:/Users/arpit/Desktop/main orca/orca new - Copy antg/orca/backend/src", [".js"])
# filter for weather / ocean / sensor / fallback lines
adapter_js_findings = [f for f in backend_findings if any(kw in f[0].lower() for kw in ["adapter", "meteo", "weather", "ocean", "ingest", "sensor"])]
if not adapter_js_findings:
    print("Clean: 0 numeric literal fallbacks in backend ingestion/adapter paths")
else:
    for rel, ln, desc, text in adapter_js_findings:
        print(f"  {rel}:{ln} [{desc}] -> {text}")

print("\n--- All JS findings in backend/src/ (pagination/timeouts/defaults): ---")
print(f"Total pagination/port/timeout default occurrences in backend: {len(backend_findings)}")
for rel, ln, desc, text in backend_findings[:15]:
    print(f"  {rel}:{ln} -> {text}")
print("================================================================================")
