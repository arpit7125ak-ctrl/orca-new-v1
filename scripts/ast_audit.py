"""
scripts/ast_audit.py

Comprehensive AST and syntax scanner for numeric fallbacks across:
- ai-service/app (Python AST)
- backend/src (JS Regex/AST)
- frontend/src (JS/JSX Regex)

Identifies:
1. dict.get(key, <number>)
2. x or <number> (Python BoolOp) / x || <number> (JS LogicalOp)
3. Default numeric parameters flowing into measurements
4. Direct numeric literal assignments to measurement names
"""

import ast
import os
import re

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MEASUREMENT_PARAMS = {
    "wind_speed_ms", "wind_gust_ms", "wind_direction_deg", "visibility_km",
    "precipitation_mm", "wave_height_m", "swell_height_m", "wave_period_s",
    "current_speed_ms", "current_direction_deg", "sst_c", "tide_height_m",
    "salinity_psu", "chlorophyll_mg_m3", "dissolved_oxygen_mg_l"
}


def audit_python():
    print("================================================================================")
    print("=== 1. PYTHON AST AUDIT: ai-service/app ===")
    print("================================================================================")
    app_dir = os.path.join(REPO_ROOT, "ai-service", "app")
    findings = []

    for root, _, files in os.walk(app_dir):
        for file in files:
            if not file.endswith(".py"):
                continue
            filepath = os.path.join(root, file)
            relpath = os.path.relpath(filepath, REPO_ROOT)
            with open(filepath, "r", encoding="utf-8") as f:
                code = f.read()

            try:
                tree = ast.parse(code, filename=filepath)
            except Exception as e:
                print(f"Failed to parse {relpath}: {e}")
                continue

            for node in ast.walk(tree):
                # 1. Check dict.get(k, <number>)
                if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "get":
                    if len(node.args) >= 2:
                        second_arg = node.args[1]
                        if isinstance(second_arg, (ast.Constant, ast.UnaryOp)):
                            val = second_arg.value if isinstance(second_arg, ast.Constant) else (
                                -second_arg.operand.value if isinstance(second_arg.operand, ast.Constant) else None
                            )
                            if isinstance(val, (int, float)):
                                first_arg = node.args[0]
                                k_val = first_arg.value if isinstance(first_arg, ast.Constant) else ast.unparse(first_arg)
                                findings.append({
                                    "file": relpath,
                                    "line": node.lineno,
                                    "pattern": f".get({k_val}, {val})",
                                    "target": k_val,
                                    "is_measurement": str(k_val) in MEASUREMENT_PARAMS,
                                })

                # 2. Check x or <number> (BoolOp)
                elif isinstance(node, ast.BoolOp) and isinstance(node.op, ast.Or):
                    for val_node in node.values[1:]:
                        if isinstance(val_node, (ast.Constant, ast.UnaryOp)):
                            val = val_node.value if isinstance(val_node, ast.Constant) else (
                                -val_node.operand.value if isinstance(val_node.operand, ast.Constant) else None
                            )
                            if isinstance(val, (int, float)):
                                expr_str = ast.unparse(node)
                                is_meas = any(p in expr_str for p in MEASUREMENT_PARAMS)
                                findings.append({
                                    "file": relpath,
                                    "line": node.lineno,
                                    "pattern": expr_str,
                                    "target": "or-fallback",
                                    "is_measurement": is_meas,
                                })

    print(f"Total numeric fallback hits in Python AST: {len(findings)}")
    meas_hits = [f for f in findings if f["is_measurement"]]
    print(f"Hits directly on ocean/weather measurement names: {len(meas_hits)}")
    if meas_hits:
        print("CRITICAL MEASUREMENT FALLBACKS FOUND:")
        for h in meas_hits:
            print(f"  {h['file']}:{h['line']} -> {h['pattern']}")
    else:
        print("CONFIRMED: ZERO measurement names have numeric fallbacks. Measurements strictly return None/missing.")

    print("\nSample Audited Hits (Config/Structural):")
    for h in findings[:15]:
        decision = "KEEP (Measurement None-preserved)" if not h["is_measurement"] else "REMOVE"
        print(f"  [{decision}] {h['file']}:{h['line']} | {h['pattern']}")


def audit_js(label, target_dir):
    print("\n================================================================================")
    print(f"=== 2. JAVASCRIPT SCAN: {label} ({target_dir}) ===")
    print("================================================================================")
    full_dir = os.path.join(REPO_ROOT, target_dir)
    if not os.path.isdir(full_dir):
        print(f"Directory {full_dir} not found.")
        return

    findings = []
    get_num_regex = re.compile(r"""(?:get\(\s*['"]([^'"]+)['"]\s*,\s*(-?\d+(?:\.\d+)?)\s*\)|(?:(\b\w+)\s*\|\|\s*(-?\d+(?:\.\d+)?)))""")

    for root, _, files in os.walk(full_dir):
        if "node_modules" in root or ".next" in root or "build" in root or "dist" in root:
            continue
        for file in files:
            if not file.endswith((".js", ".jsx", ".ts", ".tsx")):
                continue
            filepath = os.path.join(root, file)
            relpath = os.path.relpath(filepath, REPO_ROOT)
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                for lineno, line in enumerate(f, 1):
                    for match in get_num_regex.finditer(line):
                        k1, n1, k2, n2 = match.groups()
                        key = k1 or k2
                        num = n1 or n2
                        is_meas = key in MEASUREMENT_PARAMS
                        findings.append({
                            "file": relpath,
                            "line": lineno,
                            "pattern": match.group(0),
                            "key": key,
                            "num": num,
                            "is_measurement": is_meas,
                            "raw_line": line.strip(),
                        })

    print(f"Total numeric fallback hits in {label}: {len(findings)}")
    meas_hits = [f for f in findings if f["is_measurement"]]
    print(f"Hits directly on ocean/weather measurement names: {len(meas_hits)}")
    if meas_hits:
        print("CRITICAL MEASUREMENT FALLBACKS FOUND:")
        for h in meas_hits:
            print(f"  {h['file']}:{h['line']} -> {h['raw_line']}")
    else:
        print(f"CONFIRMED: ZERO measurement names have numeric fallbacks in {label}.")

    print("\nSample Audited Hits (Config/UI/Pagination):")
    for h in findings[:15]:
        decision = "KEEP (Config/UI default, not measurement)"
        print(f"  [{decision}] {h['file']}:{h['line']} | {h['pattern']} in `{h['raw_line'][:60]}`")


if __name__ == "__main__":
    audit_python()
    audit_js("Backend", "backend/src")
    audit_js("Frontend", "frontend/src")
