"""
tests/test_error_categories.py

Automated test scanning codebase against contracts/shared/ErrorInfo.json.
Validates that every error_category produced in ai-service and backend is one
of the 10 canonical categories in ErrorInfo.json.
"""

import ast
import json
import os
import re
import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ERROR_INFO_PATH = os.path.join(REPO_ROOT, "contracts", "shared", "ErrorInfo.json")
AI_SERVICE_DIR = os.path.join(REPO_ROOT, "ai-service", "app")
BACKEND_SRC_DIR = os.path.join(REPO_ROOT, "backend", "src")


def load_allowed_categories():
    with open(ERROR_INFO_PATH, "r", encoding="utf-8") as f:
        contract = json.load(f)
    return set(contract["properties"]["error_category"]["enum"])


def test_error_info_contract_categories():
    allowed = load_allowed_categories()
    expected = {
        "invalid_location",
        "unsupported_region",
        "unresolvable_place",
        "unsupported_time",
        "planner_failure",
        "risk_failure",
        "validation_failure",
        "upstream_unavailable",
        "timeout",
        "internal_error",
    }
    assert allowed == expected, f"ErrorInfo.json categories do not match expected: {allowed}"
    assert "inland_point_not_supported" not in allowed


def test_ai_service_python_ast_error_categories():
    """Scan Python ASTs in ai-service/app for string values assigned to error_category."""
    allowed = load_allowed_categories()
    findings = []

    for root, _, files in os.walk(AI_SERVICE_DIR):
        for file in files:
            if not file.endswith(".py"):
                continue
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()

            tree = ast.parse(content, filename=path)
            for node in ast.walk(tree):
                # Check dict keys
                if isinstance(node, ast.Dict):
                    for k, v in zip(node.keys, node.values):
                        if isinstance(k, ast.Constant) and k.value == "error_category":
                            if isinstance(v, ast.Constant) and isinstance(v.value, str):
                                if v.value not in allowed:
                                    findings.append((path, node.lineno, v.value))
                # Check return or assignments
                elif isinstance(node, ast.Return):
                    if isinstance(node.value, ast.Tuple):
                        for elt in node.value.elts:
                            if isinstance(elt, ast.Constant) and isinstance(elt.value, str):
                                # If it looks like an error category name ending with _failure or _location etc
                                if elt.value in {
                                    "inland_point_not_supported",
                                    "outside_domain",
                                    "not_supported",
                                }:
                                    findings.append((path, node.lineno, elt.value))

    assert not findings, f"Found non-canonical error categories in ai-service: {findings}"


def test_backend_error_categories_match_contract():
    """Verify backend/src/errors/errorCategories.js matches ErrorInfo.json."""
    allowed = load_allowed_categories()
    js_path = os.path.join(BACKEND_SRC_DIR, "errors", "errorCategories.js")
    with open(js_path, "r", encoding="utf-8") as f:
        js_content = f.read()

    # Extract all string values inside ERROR_CATEGORIES = Object.freeze({ ... })
    match = re.search(r"ERROR_CATEGORIES\s*=\s*Object\.freeze\(\{([^}]+)\}\)", js_content, re.DOTALL)
    assert match, "Could not find ERROR_CATEGORIES in errorCategories.js"
    block = match.group(1)
    values = set(re.findall(r":\s*['\"]([^'\"]+)['\"]", block))

    assert values == allowed, f"Backend ERROR_CATEGORIES {values} != contract {allowed}"


def test_no_inland_point_not_supported_anywhere():
    """Ensure inland_point_not_supported is nowhere in ai-service/app or backend/src."""
    forbidden = "inland_point_not_supported"
    hits = []
    for search_dir in [AI_SERVICE_DIR, BACKEND_SRC_DIR]:
        for root, _, files in os.walk(search_dir):
            for file in files:
                if not file.endswith((".py", ".js", ".json")):
                    continue
                path = os.path.join(root, file)
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    for idx, line in enumerate(f, 1):
                        if forbidden in line:
                            hits.append((path, idx, line.strip()))
    assert not hits, f"Found forbidden '{forbidden}': {hits}"
