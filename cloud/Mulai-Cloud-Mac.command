#!/bin/bash
cd "$(dirname "$0")"
echo "Memulai HVEN Cloud di Mac..."
if command -v python3 >/dev/null 2>&1; then
  python3 hven-cloud.py
else
  echo "Python 3 belum ada. Buka App Store / instal Python, lalu klik file ini lagi."
  read -r _
fi
