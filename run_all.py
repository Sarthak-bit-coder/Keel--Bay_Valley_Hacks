"""One command to reproduce results. Each role fills in its step."""
import subprocess, sys

PY = sys.executable  # same interpreter (e.g. .venv) for every step

STEPS = [
    ("A: build weekly earnings", [PY, "src/data/build_weekly.py"]),
    ("B: train forecaster + calibrate", [PY, "src/model/train.py"]),
    ("B: salary policy + evaluation", [PY, "eval/run_eval.py"]),
]

for name, cmd in STEPS:
    print("==", name)
    r = subprocess.run(cmd)
    if r.returncode != 0:
        sys.exit(f"Step failed: {name}")
print("Done. See outputs/results.json")
