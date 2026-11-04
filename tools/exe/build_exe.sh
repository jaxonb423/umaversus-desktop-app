#!/bin/sh
# Builds "Uma Versus Desktop.exe" from Linux/Mac/Windows with Zig (pip install ziglang).
set -e
cd "$(dirname "$0")"
python3 -m ziglang cc -target x86_64-windows-gnu -O2 -municode -Wl,--subsystem,windows -s \
  launcher_exe.c launcher_exe.rc -luser32 -o "../../Uma Versus Desktop.exe"
echo built "../../Uma Versus Desktop.exe"
