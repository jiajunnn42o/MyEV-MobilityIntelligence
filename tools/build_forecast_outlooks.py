"""VOLTERRA scenario preparation, Python standard library only.

Derives sensitivity trajectories from the existing national JPJ market.json.
These are assumption-led scenario paths, NOT the fitted academic M9 model.
Leave market.json and its original M9 forecast unchanged.

Run at the project root:
    python tools/build_forecast_outlooks.py
"""

import json
import math
from datetime import date
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parents[1]
MARKET_FILE = ROOT / 'src' / 'data' / 'market.json'
OUTPUT_FILE = ROOT / 'src' / 'data' / 'forecast_outlooks.json'


def plus_one_month(month: str) -> str:
    year, mm = map(int, month.split('-'))
    return f'{year + (mm == 12):04d}-{mm % 12 + 1:02d}'


def robust_growth_rate(values, ceiling, window=24):
    """Theil-Sen slope for capped log-odds over a fixed trailing window."""
    sample = values[-window:]
    if len(sample) != window:
        raise ValueError(f'Need {window} historical monthly observations.')
    if not all(0 < p < ceiling for p in sample):
        raise ValueError('Adoption ceiling must exceed every value in the fit window.')
    odds = [math.log(p / (ceiling - p)) for p in sample]
    slopes = [
        (odds[j] - odds[i]) / (j - i)
        for i in range(len(odds))
        for j in range(i + 1, len(odds))
    ]
    return median(slopes)


def scenario_value(p0, ceiling, growth, months):
    return ceiling / (1.0 + (ceiling / p0 - 1.0) * math.exp(-growth * months))


def main():
    source = json.loads(MARKET_FILE.read_text(encoding='utf-8'))
    historical = source['monthly']
    raw_forecast = source['forecast']
    values = [float(row['evOfElectrified']) for row in historical]
    p0 = values[-1]
    date0 = historical[-1]['date']

    if len(values) < 24 or len(raw_forecast) < 1:
        raise ValueError('Not enough historical or forecast observations.')
    if raw_forecast[0]['date'] <= date0:
        raise ValueError('Forecast begins before the last historical observation.')

    scenarios = {}
    for key, k in [('lower', 80.0), ('base', 85.0), ('upper', 95.0)]:
        growth = robust_growth_rate(values, k, window=24)
        scenarios[key] = {
            'ceiling': k,
            'growth_per_month': round(growth, 6),
            'values': [
                {
                    'date': row['date'],
                    'value': round(scenario_value(p0, k, growth, i + 1), 4)
                }
                for i, row in enumerate(raw_forecast)
            ]
        }

    result = {
        'source': 'JPJ nationwide passenger-car electric and hybrid monthly registrations',
        'as_of': date0,
        'target': 'EV share within EV + Hybrid car registrations, percent',
        'anchor_value': round(p0, 4),
        'historical_max': round(max(values), 4),
        'window_months': 24,
        'method': 'Anchored bounded logistic scenarios with Theil-Sen growth in capped log-odds',
        'research_model': 'Original M9 Logistic + AR(1) retained in market.json without modification',
        'warning': 'Scenario trajectories are assumptions, not statistically validated forecasts. The range is NOT a 95% confidence or prediction interval.',
        'scenarios': scenarios,
    }
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print('Saved', OUTPUT_FILE)
    print('Last observed:', p0)
    for name, item in scenarios.items():
        print(f"{name}: K={item['ceiling']}, g={item['growth_per_month']}, 2030={item['values'][-1]['value']}%")


if __name__ == '__main__':
    main()
