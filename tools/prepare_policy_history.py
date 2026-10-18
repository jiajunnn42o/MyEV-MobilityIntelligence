"""Generate VOLTERRA policy-only national monthly records from JPJ CSV.

Run from VOLTERRA project root:
    python tools/prepare_policy_history.py

Reads data/raw/registrations_type_fuel.csv and writes
src/data/policy_history.json. Uses only Python standard library.
This does not modify market.json or train any forecasting model.
"""

import csv
import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data" / "raw" / "registrations_type_fuel.csv"
OUTPUT = ROOT / "src" / "data" / "policy_history.json"


def build(source: Path, destination: Path) -> list[dict]:
    if not source.is_file():
        raise FileNotFoundError(f"Cannot find source CSV: {source}")

    raw: dict[str, dict[str, int]] = defaultdict(dict)
    with source.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {"date", "type", "fuel", "registrations"}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError("CSV must have date, type, fuel and registrations columns")

        for item in reader:
            if item["type"] != "car":
                continue
            date = datetime.strptime(item["date"], "%Y-%m-%d").strftime("%Y-%m")
            fuel = item["fuel"].strip()
            count = int(item["registrations"])
            if count < 0:
                raise ValueError(f"Negative registrations: {date} / {fuel}")
            if fuel in raw[date]:
                raise ValueError(f"Duplicate date/fuel pair: {date} / {fuel}")
            raw[date][fuel] = count

    result = []
    for month, values in sorted(raw.items()):
        if "all_fuels" not in values:
            # Do not invent a denominator for missing total-car records.
            continue
        total = values["all_fuels"]
        electric = values.get("electric", 0)
        hybrid = values.get("hybrid", 0)
        petrol = values.get("petrol", 0)
        if electric + hybrid > total:
            raise ValueError(f"Electric + hybrid exceeds car total for {month}")
        result.append({
            "date": month,
            "total": total,
            "ev": electric,
            "hybrid": hybrid,
            "petrol": petrol,
            "evShare": round(electric / total * 100, 4) if total else None,
            "hybridShare": round(hybrid / total * 100, 4) if total else None,
            "electrifiedShare": round((electric + hybrid) / total * 100, 4) if total else None,
            "evOfElectrified": round(electric / (electric + hybrid) * 100, 4) if electric + hybrid else None,
        })

    if not result:
        raise ValueError("No passenger car monthly records were found")
    payload = {
        "meta": {
            "source": "JPJ · registrations_type_fuel.csv · passenger car monthly records",
            "first_month": result[0]["date"],
            "last_month": result[-1]["date"],
            "rows": len(result),
            "note": "Descriptive national registrations only; not causal policy effect estimates.",
        },
        "monthly": result,
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return result


if __name__ == "__main__":
    rows = build(INPUT, OUTPUT)
    print(f"Policy history ready: {len(rows)} months ({rows[0]['date']} to {rows[-1]['date']})")
    print(f"Output: {OUTPUT}")
