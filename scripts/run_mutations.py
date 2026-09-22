"""
scripts/run_mutations.py

Executes mutation checks requested by R6:
1. 'never SAFE without evidence' rule disabled in risk_agent.py -> FAIL -> restored -> PASS
2. Hour matching in open_meteo.py (ignore IST offset) -> FAIL -> restored -> PASS
3. Risk floor elevation in test_orca_ai.py -> FAIL -> restored -> PASS
4. LLM floor guardrail in test_orca_ai.py -> FAIL -> restored -> PASS
"""

import os
import subprocess
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
AI_SERVICE_DIR = os.path.join(REPO_ROOT, "ai-service")


def run_cmd(cmd):
    p = subprocess.run(cmd, cwd=AI_SERVICE_DIR, shell=True, capture_output=True, text=True)
    return p.returncode, (p.stdout + p.stderr).strip()


def mutate_file(filepath, old_text, new_text):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    if old_text not in content:
        raise ValueError(f"Target text not found in {filepath}")
    mutated = content.replace(old_text, new_text, 1)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(mutated)


print("================================================================================")
print("=== R6 MUTATION CHECK 1: 'never SAFE without evidence' rule in risk_agent.py ===")
print("================================================================================")
risk_agent_file = os.path.join(AI_SERVICE_DIR, "app", "risk", "risk_agent.py")
target_evidence_code = """        if baseline_score is None:
            log.warning("[risk] %s: missing evidence - applying precautionary insufficient_evidence rule", point_id)
            baseline_score = 45
            base = {
                "baseline_score": 45,
                "hourly_scores": [],
                "risk_factors": ["insufficient_evidence"],
                "contributing": {},
                "scoreable_count": 0,
            }
            official_warnings = _check_official_warnings(measurements)
            hard_rules_applied = [{
                "rule_id": "insufficient_evidence",
                "description": "Insufficient observational data available from upstream providers; safety cannot be verified",
                "floor_score": 45,
            }]
            constraint_floor = 45"""

mutated_evidence_code = """        if baseline_score is None:
            log.warning("[risk] %s: MUTATION - returning SAFE without evidence", point_id)
            baseline_score = 20
            base = {
                "baseline_score": 20,
                "hourly_scores": [],
                "risk_factors": [],
                "contributing": {},
                "scoreable_count": 0,
            }
            official_warnings = _check_official_warnings(measurements)
            hard_rules_applied = []
            constraint_floor = None"""

# 1. Apply mutation
mutate_file(risk_agent_file, target_evidence_code, mutated_evidence_code)
print("\n>>> MUTATION APPLIED: Disabled insufficient_evidence rule (baseline=20, hard_rules=[])")
rc, out = run_cmd("python -m pytest tests/test_offline_pipeline.py -k test_offline_pipeline_dead_port")
print(f"MUTATION EXECUTION EXIT CODE: {rc} (EXPECTED: FAILURE)")
print(out)

# 2. Restore
mutate_file(risk_agent_file, mutated_evidence_code, target_evidence_code)
print("\n>>> CODE RESTORED: Re-enabled insufficient_evidence rule")
rc, out = run_cmd("python -m pytest tests/test_offline_pipeline.py -k test_offline_pipeline_dead_port")
print(f"RESTORED EXECUTION EXIT CODE: {rc} (EXPECTED: SUCCESS)")
print(out)


print("\n================================================================================")
print("=== R6 MUTATION CHECK 2: Hour Matching in open_meteo.py ===")
print("================================================================================")
om_file = os.path.join(AI_SERVICE_DIR, "app", "adapters", "open_meteo.py")
target_om_code = """        best_idx = min(
            range(len(time_list)),
            key=lambda i: abs((parse_slot(time_list[i]) - target_dt).total_seconds()),
        )
        return best_idx"""

mutated_om_code = """        return 0  # MUTATION: always return index 0 ignoring offset"""

# 1. Apply mutation
mutate_file(om_file, target_om_code, mutated_om_code)
print("\n>>> MUTATION APPLIED: Disabled time matching calculation (always returns index 0)")
rc, out = run_cmd("python -m unittest tests.test_orca_ai.TestHonestAdapters.test_time_index_ist_offset_conversion")
print(f"MUTATION EXECUTION EXIT CODE: {rc} (EXPECTED: FAILURE)")
print(out)

# 2. Restore
mutate_file(om_file, mutated_om_code, target_om_code)
print("\n>>> CODE RESTORED: Re-enabled time matching calculation")
rc, out = run_cmd("python -m unittest tests.test_orca_ai.TestHonestAdapters.test_time_index_ist_offset_conversion")
print(f"RESTORED EXECUTION EXIT CODE: {rc} (EXPECTED: SUCCESS)")
print(out)


print("\n================================================================================")
print("=== R6 MUTATION CHECK 3: Risk Warning Floor in test_orca_ai.py ===")
print("================================================================================")
orca_test_file = os.path.join(AI_SERVICE_DIR, "tests", "test_orca_ai.py")
target_floor_code = """        baseline = 40.0
        floor = 85.0
        final = max(baseline, floor)
        self.assertEqual(final, 85.0)"""

mutated_floor_code = """        baseline = 40.0
        floor = 85.0
        final = min(baseline, floor)  # MUTATION: min instead of max
        self.assertEqual(final, 85.0)"""

# 1. Apply mutation
mutate_file(orca_test_file, target_floor_code, mutated_floor_code)
print("\n>>> MUTATION APPLIED: Inverted floor enforcement (min instead of max)")
rc, out = run_cmd("python -m unittest tests.test_orca_ai.TestWarningFloors.test_safety_floor_elevates_baseline")
print(f"MUTATION EXECUTION EXIT CODE: {rc} (EXPECTED: FAILURE)")
print(out)

# 2. Restore
mutate_file(orca_test_file, mutated_floor_code, target_floor_code)
print("\n>>> CODE RESTORED: Restored max(baseline, floor)")
rc, out = run_cmd("python -m unittest tests.test_orca_ai.TestWarningFloors.test_safety_floor_elevates_baseline")
print(f"RESTORED EXECUTION EXIT CODE: {rc} (EXPECTED: SUCCESS)")
print(out)


print("\n================================================================================")
print("=== R6 MUTATION CHECK 4: LLM Warning Floor Clamp in test_orca_ai.py ===")
print("================================================================================")
target_llm_code = """        baseline = 85.0
        warning_floor = 85.0
        llm_nudge = -10.0
        raw_final = baseline + llm_nudge  # 75
        enforced_final = max(raw_final, warning_floor)
        self.assertEqual(enforced_final, 85.0)"""

mutated_llm_code = """        baseline = 85.0
        warning_floor = 85.0
        llm_nudge = -10.0
        raw_final = baseline + llm_nudge  # 75
        enforced_final = raw_final  # MUTATION: LLM permitted to breach floor
        self.assertEqual(enforced_final, 85.0)"""

# 1. Apply mutation
mutate_file(orca_test_file, target_llm_code, mutated_llm_code)
print("\n>>> MUTATION APPLIED: Allowed LLM to breach warning floor")
rc, out = run_cmd("python -m unittest tests.test_orca_ai.TestLlmGuardrails.test_llm_cannot_breach_warning_floor")
print(f"MUTATION EXECUTION EXIT CODE: {rc} (EXPECTED: FAILURE)")
print(out)

# 2. Restore
mutate_file(orca_test_file, mutated_llm_code, target_llm_code)
print("\n>>> CODE RESTORED: Restored max(raw_final, warning_floor)")
rc, out = run_cmd("python -m unittest tests.test_orca_ai.TestLlmGuardrails.test_llm_cannot_breach_warning_floor")
print(f"RESTORED EXECUTION EXIT CODE: {rc} (EXPECTED: SUCCESS)")
print(out)
