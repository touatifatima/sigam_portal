"""
Utility to sanitize one or more PGDUMP .sql files so they can be
loaded into a UTF-8 PostgreSQL database.

We don't care about preserving weird legacy characters (broken Arabic,
control bytes, etc.) inside text fields; the important parts are:
  - geometry hex strings (0-9A-F)
  - ASCII attributes (ids, codes, dates, type labels)

Strategy:
  - Keep ASCII printable bytes as-is (0x20-0x7E), plus LF/CR/TAB.
  - For anything else (>= 0x80 or control chars except LF/CR/TAB),
    replace with a simple ASCII placeholder (' ').
This guarantees the result is valid UTF-8 and safe for psql.

Usage:
  python convrt.py CMASIG_titres.sql CMASIG_exclusion.sql ...
It will write CMASIG_titres_clean.sql, CMASIG_exclusion_clean.sql, etc.
"""

import sys
import os

def sanitize(src: str, dst: str) -> None:
  data = open(src, "rb").read()
  clean = bytearray()
  for b in data:
    if b in (0x0A, 0x0D, 0x09):  # LF, CR, TAB
      clean.append(b)
    elif 0x20 <= b <= 0x7E:      # printable ASCII
      clean.append(b)
    else:
      # Replace any other byte (including legacy control chars) with space
      clean.append(0x20)
  with open(dst, "wb") as f:
    f.write(clean)
  print(f"Sanitized {src} -> {dst}")

if __name__ == "__main__":
  default_files = [
    "CMASIG_wilayas.sql",
    "CMASIG_communes.sql",
    "CMASIG_villes.sql",
    "CMASIG_exclusion.sql",
    "CMASIG_modifications.sql",
    "CMASIG_promotion.sql",
    "CMASIG_titres.sql",
    "CMASIG_pays.sql"
  ]

  targets = sys.argv[1:] if len(sys.argv) > 1 else default_files
  if not targets:
    print("Usage: python convrt.py file1.sql [file2.sql ...]")
    sys.exit(1)

  for src in targets:
    if not os.path.exists(src):
      print(f"Skip {src}: not found")
      continue
    base, ext = os.path.splitext(src)
    dst = f"{base}_clean{ext or '.sql'}"
    sanitize(src, dst)
