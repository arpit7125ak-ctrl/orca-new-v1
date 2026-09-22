"""
scripts/package_orca_final.py

Creates a clean orca_final.zip archive of the codebase, excluding:
- .git
- node_modules
- __pycache__
- .pytest_cache
- .venv
- existing orca_final.zip
"""

import os
import zipfile
import time

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_ZIP = os.path.join(ROOT_DIR, "orca_final.zip")

EXCLUDE_DIRS = {
    ".git",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".venv",
    "venv",
    ".idea",
    ".vscode",
    "mongo_data",
    "claude_handover",
}

EXCLUDE_FILES = {
    "orca_final.zip",
    "result.md",
    "test_runtime_e2e.py",
}

def is_excluded_file(filename: str) -> bool:
    if filename in EXCLUDE_FILES:
        return True
    if filename == ".env" or (filename.endswith(".env") and not filename.endswith(".env.example")):
        return True
    if filename.startswith("mongod.log"):
        return True
    if filename.endswith(".pyc"):
        return True
    return False

def make_archive():
    print(f"Building clean orca_final.zip from {ROOT_DIR}...")
    start_time = time.time()
    file_count = 0
    total_size = 0

    with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(ROOT_DIR):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.endswith(".egg-info")]
            for file in files:
                if is_excluded_file(file):
                    continue
                abs_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_path, ROOT_DIR)
                zf.write(abs_path, rel_path)
                file_count += 1
                total_size += os.path.getsize(abs_path)

    zip_size = os.path.getsize(OUTPUT_ZIP)
    duration = time.time() - start_time
    print(f"Successfully created {OUTPUT_ZIP}")
    print(f"Total files: {file_count} | Uncompressed: {total_size / (1024*1024):.2f} MB | Zip size: {zip_size / (1024*1024):.2f} MB")
    print(f"Completed in {duration:.2f} seconds.")

if __name__ == "__main__":
    make_archive()
