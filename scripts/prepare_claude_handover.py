"""
scripts/prepare_claude_handover.py

Creates/refreshes the 'claude_handover' directory with all necessary
handover files for Claude, deleting any stale/outdated files in that directory.
"""

import os
import shutil
import time

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HANDOVER_DIR = os.path.join(ROOT_DIR, "claude_handover")

def prepare_handover():
    print(f"Preparing Claude handover folder at: {HANDOVER_DIR}")
    
    # 1. Clean old handover folder if it exists
    if os.path.exists(HANDOVER_DIR):
        print("Cleaning old handover directory...")
        shutil.rmtree(HANDOVER_DIR)
    
    os.makedirs(HANDOVER_DIR, exist_ok=True)
    
    # 2. Files to copy directly
    files_to_copy = [
        ("orca_final.zip", "orca_final.zip"),
        ("CHANGELOG_FINAL.md", "CHANGELOG_FINAL.md"),
        ("contracts.zip", "contracts.zip"),
    ]
    
    for src_rel, dst_name in files_to_copy:
        src_path = os.path.join(ROOT_DIR, src_rel)
        dst_path = os.path.join(HANDOVER_DIR, dst_name)
        if os.path.exists(src_path):
            shutil.copy2(src_path, dst_path)
            size_mb = os.path.getsize(dst_path) / (1024 * 1024)
            print(f"Copied: {dst_name} ({size_mb:.2f} MB)")
        else:
            print(f"WARNING: Source file not found: {src_rel}")

    print("Copying complete. Writing handover markdown documents...")

if __name__ == "__main__":
    prepare_handover()
