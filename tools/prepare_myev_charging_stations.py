#!/usr/bin/env python3
"""MyEV: export real OSM EV charging locations into a lightweight JSON snapshot.

No paid API key required. OpenStreetMap / Overpass data (ODbL) is not a live
charger availability feed and is not a complete official registry.

Usage:
    python tools/prepare_myev_charging_stations.py

Offline/test mode with your own authentic Overpass export:
    python tools/prepare_myev_charging_stations.py --input path/to/overpass.json

The script does not invent station coordinates or details.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import time
import urllib.error
import urllib.request
import urllib.parse
from collections import Counter
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = PROJECT / 'public' / 'data' / 'malaysia_ev_charging_stations.json'
DEFAULT_BOUNDARIES = PROJECT / 'public' / 'data' / 'malaysia-states.geojson'
DOSM_BOUNDARIES_URL = 'https://raw.githubusercontent.com/dosm-malaysia/data-open/main/datasets/geodata/administrative_1_state.geojson'
OVERPASS_ENDPOINTS = (
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.nchc.org.tw/api/interpreter',
)
OVERPASS_QUERY = '''[out:json][timeout:180];
area["ISO3166-1"="MY"][admin_level="2"]->.my;
(
  node["amenity"="charging_station"](area.my);
  way["amenity"="charging_station"](area.my);
  relation["amenity"="charging_station"](area.my);
);
out center tags;
'''

STATE_ALIASES = {
    'johor': 'Johor', 'kedah': 'Kedah', 'kelantan': 'Kelantan',
    'melaka': 'Melaka', 'malacca': 'Melaka', 'negeri sembilan': 'Negeri Sembilan',
    'pahang': 'Pahang', 'perak': 'Perak', 'perlis': 'Perlis',
    'pulau pinang': 'Pulau Pinang', 'penang': 'Pulau Pinang',
    'sabah': 'Sabah', 'sarawak': 'Sarawak', 'selangor': 'Selangor',
    'terengganu': 'Terengganu', 'trengganu': 'Terengganu',
    'kuala lumpur': 'W.P. Kuala Lumpur', 'wp kuala lumpur': 'W.P. Kuala Lumpur',
    'w.p. kuala lumpur': 'W.P. Kuala Lumpur',
    'wilayah persekutuan kuala lumpur': 'W.P. Kuala Lumpur',
    'putrajaya': 'W.P. Putrajaya', 'wp putrajaya': 'W.P. Putrajaya', 'wilayah persekutuan putrajaya': 'W.P. Putrajaya',
    'labuan': 'W.P. Labuan', 'wp labuan': 'W.P. Labuan', 'wilayah persekutuan labuan': 'W.P. Labuan',
}


def normalize_state(name: object) -> str | None:
    key = re.sub(r'\s+', ' ', str(name or '').strip().lower())
    key = key.replace('w.p.', 'wp').replace('w.p ', 'wp ')
    key = re.sub(r'^(state of |negeri )', '', key)
    return STATE_ALIASES.get(key)


def get_overpass_json() -> dict:
    # Single country-wide read, not a query-per-user/per-map-pan workflow.
    form = urllib.parse.urlencode({'data': OVERPASS_QUERY}).encode('utf-8')
    errors: list[str] = []
    for url in OVERPASS_ENDPOINTS:
        print(f'Fetching OSM charging station records: {url}', flush=True)
        request = urllib.request.Request(url, data=form, headers={
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Accept': 'application/json',
            'User-Agent': 'MyEV-Research-Project/1.0 (local snapshot; OpenStreetMap/ODbL)',
        }, method='POST')
        try:
            with urllib.request.urlopen(request, timeout=210) as response:
                payload = response.read()
            data = json.loads(payload)
            if not isinstance(data.get('elements'), list):
                raise ValueError('Overpass did not return an elements array.')
            return data
        except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
            errors.append(f'{url}: {exc}')
            print(f'  Failed: {exc}', file=sys.stderr)
            time.sleep(2)
    raise RuntimeError('All Overpass endpoints failed. Retry later or use --input with a saved OSM Overpass JSON export.\n' + '\n'.join(errors))


def ensure_boundaries(path: Path, *, allow_download: bool = True) -> bool:
    """Cache authoritative DOSM state polygons for coordinate-to-state matching.

    A missing or unavailable boundary file never triggers nearest-city guessing.
    """
    if path.exists():
        return True
    if not allow_download:
        return False
    print(f'DOSM state boundaries not found; downloading {DOSM_BOUNDARIES_URL}', flush=True)
    try:
        request = urllib.request.Request(DOSM_BOUNDARIES_URL, headers={
            'User-Agent': 'MyEV-Research-Project/1.0 (non-commercial state boundary cache)',
            'Accept': 'application/geo+json,application/json',
        })
        with urllib.request.urlopen(request, timeout=35) as response:
            raw = response.read()
        parsed = json.loads(raw)
        if parsed.get('type') != 'FeatureCollection' or not parsed.get('features'):
            raise ValueError('Expected a non-empty GeoJSON FeatureCollection')
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix(path.suffix + '.tmp')
        temp.write_bytes(raw)
        temp.replace(path)
        print(f'Cached {len(parsed["features"])} DOSM administrative boundaries to {path}')
        return True
    except (urllib.error.URLError, TimeoutError, ValueError, OSError, json.JSONDecodeError) as exc:
        print(f'Warning: could not retrieve DOSM boundaries ({exc}). Unmatched states remain unknown.', file=sys.stderr)
        return False


def polygons_from_geojson(path: Path):
    """Build a modest indexed set of state exteriors for point-to-state lookup."""
    if not path.exists():
        print(f'Note: {path.name} not found; using only explicitly tagged states.')
        return []
    collection = json.loads(path.read_text(encoding='utf-8'))
    entries = []
    for feature in collection.get('features', []):
        props = feature.get('properties') or {}
        state = next((normalize_state(props.get(k)) for k in (
            'state', 'name', 'NAME_1', 'NAME', 'STATE_NAME', 'state_name', 'State', 'STATE', 'nam', 'NAM'
        ) if normalize_state(props.get(k))), None)
        if not state:
            continue
        geometry = feature.get('geometry') or {}
        if geometry.get('type') == 'Polygon':
            polygons = [geometry.get('coordinates')]
        elif geometry.get('type') == 'MultiPolygon':
            polygons = geometry.get('coordinates')
        else:
            continue
        for polygon in polygons:
            if not polygon or not polygon[0]:
                continue
            outer = polygon[0]
            # bounding-box prefilter keeps point lookup fast even for complex states.
            west = min(c[0] for c in outer)
            east = max(c[0] for c in outer)
            south = min(c[1] for c in outer)
            north = max(c[1] for c in outer)
            entries.append((state, (west, south, east, north), polygon))
    return entries


def inside_ring(lng: float, lat: float, ring: list) -> bool:
    inside = False
    px, py = ring[-1][:2]
    for point in ring:
        x, y = point[:2]
        if (y > lat) != (py > lat):
            hit_x = (px - x) * (lat - y) / (py - y) + x
            if lng < hit_x:
                inside = not inside
        px, py = x, y
    return inside


def infer_state(lng: float, lat: float, polygon_index: list) -> str | None:
    for state, (west, south, east, north), polygon in polygon_index:
        if not (west <= lng <= east and south <= lat <= north):
            continue
        if inside_ring(lng, lat, polygon[0]) and not any(inside_ring(lng, lat, hole) for hole in polygon[1:]):
            return state
    return None


def parse_number(value: object) -> float | None:
    values = re.findall(r'(\d+(?:[.,]\d+)?)\s*(kW|kVA|W)\b', str(value or ''), flags=re.I)
    if not values:
        return None
    nums = []
    for raw, unit in values:
        x = float(raw.replace(',', '.'))
        if unit.lower() == 'w':
            x /= 1000
        # kVA is not equivalent to kW without a power factor: skip.
        if unit.lower() == 'kva':
            continue
        if 0 < x <= 1000:
            nums.append(x)
    return max(nums) if nums else None


def extract_connectors(tags: dict):
    connectors = set()
    ac = dc = False
    power_values = []
    socket_names = {
        'type2': ('Type 2', 'ac'),
        'type2_combo': ('CCS2', 'dc'),
        'ccs2': ('CCS2', 'dc'),
        'ccs': ('CCS', 'dc'),
        'chademo': ('CHAdeMO', 'dc'),
        'type1': ('Type 1', 'ac'),
        'type1_combo': ('CCS1', 'dc'),
        'ccs1': ('CCS1', 'dc'),
        'schuko': ('Schuko', 'ac'),
        'tesla_supercharger': ('Tesla Supercharger', 'dc'),
        'tesla_destination': ('Tesla Destination', 'ac'),
        'tesla': ('Tesla connector (type unspecified)', 'unknown'),
        'gb/t_ac': ('GB/T AC', 'ac'),
        'gb/t_dc': ('GB/T DC', 'dc'),
    }
    for key, value in tags.items():
        if not key.startswith('socket:'):
            continue
        remainder = key[7:]
        code = remainder.split(':')[0].lower()
        if code not in socket_names:
            continue
        text = str(value).lower().strip()
        # Output values are socket metadata, not a station existence flag.
        if ':' not in remainder and text in {'no', '0', 'false'}:
            continue
        display, kind = socket_names[code]
        connectors.add(display)
        ac = ac or kind == 'ac'
        dc = dc or kind == 'dc'
        if ':output' in key:
            power = parse_number(value)
            if power is not None:
                power_values.append(power)
    for name in ('maxpower', 'charging_station:output', 'output', 'max_power'):
        power = parse_number(tags.get(name))
        if power is not None:
            power_values.append(power)
    return sorted(connectors), ac, dc, max(power_values) if power_values else None


def osm_url(element: dict) -> str:
    return f"https://www.openstreetmap.org/{element['type']}/{element['id']}"


def extract_address(tags: dict) -> str:
    fields = ['addr:housenumber', 'addr:street', 'addr:suburb', 'addr:city', 'addr:postcode']
    parts = [str(tags[k]).strip() for k in fields if tags.get(k)]
    return ', '.join(dict.fromkeys(parts))


def transform(payload: dict, boundaries: Path) -> dict:
    polygons = polygons_from_geojson(boundaries)
    stations = []
    seen = set()
    stats = Counter()
    for elem in payload.get('elements', []):
        tags = elem.get('tags') or {}
        if tags.get('amenity') != 'charging_station':
            continue
        # Exclude explicitly bike-only / non-car equipment, without guessing for unknowns.
        if tags.get('motorcar') == 'no' and tags.get('motorcycle') == 'no':
            continue
        if tags.get('motorcar') == 'no' and tags.get('bicycle') == 'yes':
            continue
        if any(tags.get(k) for k in ('disused:amenity', 'abandoned:amenity', 'removed:amenity')):
            continue
        latitude = elem.get('lat', (elem.get('center') or {}).get('lat'))
        longitude = elem.get('lon', (elem.get('center') or {}).get('lon'))
        try:
            lat, lng = float(latitude), float(longitude)
        except (ValueError, TypeError):
            continue
        if not (0.6 <= lat <= 8.8 and 99 <= lng <= 120):
            continue
        identity = f"{elem.get('type', 'node')}/{elem.get('id')}"
        if identity in seen:
            continue
        seen.add(identity)
        tagged_state = (normalize_state(tags.get('addr:state'))
                        or normalize_state(tags.get('is_in:state'))
                        or normalize_state(tags.get('addr:province')))
        inferred_state = infer_state(lng, lat, polygons) if not tagged_state else None
        state = tagged_state or inferred_state or 'State not recorded'
        state_source = 'osm_tag' if tagged_state else 'coordinate_boundary' if inferred_state else 'unresolved'
        connectors, ac, dc, power_kw = extract_connectors(tags)
        city = tags.get('addr:city') or tags.get('is_in:city') or ''
        name = tags.get('name') or tags.get('operator') or tags.get('brand') or 'EV charging location'
        operator = tags.get('operator') or tags.get('brand') or ''
        item = {
            'id': identity,
            'name': str(name),
            'lat': round(lat, 7),
            'lng': round(lng, 7),
            'state': state,
            'state_source': state_source,
            'city': str(city),
            'address': extract_address(tags),
            'operator': str(operator),
            'connectors': connectors,
            'ac': ac,
            'dc': dc,
            'power_kw': power_kw,
            'access': str(tags.get('access') or ''),
            'osm_url': osm_url(elem),
        }
        stations.append(item)
        stats[state] += 1
    stations.sort(key=lambda item: (item['state'], item['name'], item['id']))
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
    return {
        'meta': {
            'source': 'OpenStreetMap contributors via Overpass API',
            'generated_at': now,
            'license': 'ODbL 1.0',
            'tag': 'amenity=charging_station',
            'country': 'MY',
            'total_locations': len(stations),
            'coordinate_assigned': sum(1 for s in stations if s.get('state_source') == 'coordinate_boundary'),
            'state_unresolved': sum(1 for s in stations if s.get('state_source') == 'unresolved'),
            'note': 'Community-maintained locations; no real-time availability or guarantee of completeness.',
        },
        'stations': stations,
    }


def enrich_existing(snapshot: dict, boundaries: Path) -> tuple[dict, int]:
    """Apply state polygons to unknown locations without changing their coordinates.

    Station data is never fabricated or replaced with nearest-city labels.
    """
    if not isinstance(snapshot.get('stations'), list):
        raise ValueError('Existing JSON does not have a stations array')
    polygons = polygons_from_geojson(boundaries)
    if not polygons:
        raise ValueError('No recognizable state polygons found. Check --boundaries and the GeoJSON property names.')
    changed = 0
    for station in snapshot['stations']:
        known = normalize_state(station.get('state'))
        if known:
            station['state'] = known
            station.setdefault('state_source', 'original_record')
            continue
        try:
            lat = float(station['lat'])
            lng = float(station['lng'])
        except (TypeError, ValueError, KeyError):
            station['state'] = 'State not recorded'
            station['state_source'] = 'unresolved'
            continue
        inferred = infer_state(lng, lat, polygons)
        if inferred:
            station['state'] = inferred
            station['state_source'] = 'coordinate_boundary'
            changed += 1
        else:
            station['state'] = 'State not recorded'
            station['state_source'] = 'unresolved'
    snapshot.setdefault('meta', {})['coordinate_assigned'] = sum(
        station.get('state_source') == 'coordinate_boundary' for station in snapshot['stations']
    )
    snapshot['meta']['state_unresolved'] = sum(
        not normalize_state(station.get('state')) for station in snapshot['stations']
    )
    snapshot['meta']['state_boundaries_source'] = 'DOSM administrative_1_state.geojson'
    return snapshot, changed


def main() -> int:
    parser = argparse.ArgumentParser(description='Prepare a real Malaysian EV charging location snapshot for MyEV.')
    parser.add_argument('--input', type=Path, help='Offline source: downloaded authentic Overpass JSON')
    parser.add_argument('--enrich-existing', action='store_true', help='Fill unknown states in existing public/data JSON using actual coordinates and state polygons; no new OSM fetch')
    parser.add_argument('--no-boundary-download', action='store_true', help='Use only an existing local --boundaries file')
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument('--boundaries', type=Path, default=DEFAULT_BOUNDARIES)
    args = parser.parse_args()
    ensure_boundaries(args.boundaries, allow_download=not args.no_boundary_download)
    if args.enrich_existing:
        if not args.output.is_file():
            print(f'ERROR: Snapshot does not exist at {args.output}', file=sys.stderr)
            return 1
        snapshot = json.loads(args.output.read_text(encoding='utf-8'))
        try:
            snapshot, count = enrich_existing(snapshot, args.boundaries)
        except ValueError as exc:
            print(f'ERROR: {exc}', file=sys.stderr)
            return 1
        backup_dir = PROJECT / 'backup_charging_v23'
        backup_dir.mkdir(parents=True, exist_ok=True)
        stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        backup = backup_dir / f'{args.output.stem}.{stamp}.json'
        backup.write_bytes(args.output.read_bytes())
        tmp = args.output.with_suffix('.tmp')
        tmp.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        tmp.replace(args.output)
        print(f'Updated {count} previously unknown states using state-polygon containment; unresolved: {snapshot["meta"]["state_unresolved"]}')
        print(f'Existing snapshot backed up to {backup}')
        return 0
    if args.input:
        data = json.loads(args.input.read_text(encoding='utf-8'))
    else:
        data = get_overpass_json()
    output = transform(data, args.boundaries)
    output['meta']['state_boundaries_source'] = 'DOSM administrative_1_state.geojson' if args.boundaries.is_file() else 'not available'
    if not output['stations']:
        print('ERROR: No actual charging station locations were returned. No output file was written.', file=sys.stderr)
        return 1
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f"Saved {len(output['stations'])} real OSM charging features to {args.output}")
    print('Reminder: station availability, prices and access are NOT live verified.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
