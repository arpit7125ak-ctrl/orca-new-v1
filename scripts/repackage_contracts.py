"""
scripts/repackage_contracts.py

Re-packages contracts.zip deterministically from contracts/ directory,
computes SHA-256 hashes of disk files vs zipped files, and verifies integrity.
"""

import hashlib
import os
import zipfile

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CONTRACTS_DIR = os.path.join(REPO_ROOT, "contracts")
ZIP_PATH = os.path.join(REPO_ROOT, "contracts.zip")


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def sha256_file(filepath: str) -> str:
    with open(filepath, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


# 1. Package contracts.zip
with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, _, files in sorted(os.walk(CONTRACTS_DIR)):
        for file in sorted(files):
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, CONTRACTS_DIR).replace("\\", "/")
            zf.write(full_path, rel_path)

print(f"Re-packaged contracts.zip successfully from {CONTRACTS_DIR}.")

# 2. Verify SHA-256 Hash Comparison
print("\n=========================================================================================")
print(f"{'FILE PATH':<45} | {'DISK SHA-256':<64} | {'STATUS'}")
print("=========================================================================================")

mismatches = 0
total_files = 0

with zipfile.ZipFile(ZIP_PATH, "r") as zf:
    zip_entries = {z.filename: z for z in zf.infolist()}
    for root, _, files in sorted(os.walk(CONTRACTS_DIR)):
        for file in sorted(files):
            total_files += 1
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, CONTRACTS_DIR).replace("\\", "/")
            disk_hash = sha256_file(full_path)

            if rel_path not in zip_entries:
                print(f"{rel_path:<45} | MISSING IN ZIP")
                mismatches += 1
                continue

            zip_content = zf.read(rel_path)
            zip_hash = sha256_bytes(zip_content)

            if disk_hash == zip_hash:
                status = "MATCH (100% IDENTICAL)"
            else:
                status = f"MISMATCH: {zip_hash}"
                mismatches += 1

            # Print first 20 characters of hash for table readability
            print(f"{rel_path:<45} | {disk_hash} | {status}")

print("=========================================================================================")
print(f"Total Files Verified: {total_files} | Mismatches: {mismatches}")
if mismatches == 0:
    print("ALL FILES IN contracts.zip BYTE-IDENTICAL TO contracts/ ON DISK (SHA-256 VERIFIED).")
else:
    print("WARNING: Hash mismatches detected!")
