import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import * as Iconsax from 'iconsax-react';
import { renderToStaticMarkup } from 'react-dom/server';
import 'leaflet/dist/leaflet.css';
import './MalaysiaChargingStations.css';

/**
 * MyEV / Malaysia EV Charging Stations
 * Data: a local snapshot exported from OpenStreetMap with
 *       tools/prepare_myev_charging_stations.py.
 * This is NOT a live availability/charging-session service.
 * No OCM API keys or external APIs are exposed to the browser.
 */
const DATA_URL = '/data/malaysia_ev_charging_stations.json';
// Shares the official state-boundary cache already used for v23 state inference.
const BOUNDARIES_URL = '/data/malaysia-states.geojson';
const MALAYSIA_DIM_PANE = 'myev-country-focus-mask';
// A frame larger than Malaysia and its neighbours; polygons are lat/lng in Leaflet.
const REGIONAL_FRAME = [
  [-25, 70],
  [-25, 145],
  [30, 145],
  [30, 70],
];
const COUNTRY_BOUNDS = L.latLngBounds([0.65, 99.1], [8.6, 119.85]);
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const NUMBER = new Intl.NumberFormat('en-MY');
const LABELS = { all: 'All types', ac: 'AC identified', dc: 'DC identified', unknown: 'Unspecified' };

// Iconsax Bold for charging station markers and station details.
// The three map navigation controls use the simpler Linear style.
function BoldIcon({ name = 'Electricity', size = 19 }) {
  const Component = Iconsax[name] || Iconsax.Electricity;
  return <Component size={size} variant="Bold" color="currentColor" aria-hidden="true" />;
}

// Station links use clean line icons instead of text-based arrow glyphs.
function StationLinkIcon({ kind }) {
  const Component = kind === 'directions'
    ? (Iconsax.Routing2 || Iconsax.Routing || Iconsax.Location)
    : (Iconsax.Export || Iconsax.DocumentText || Iconsax.Document);
  return Component ? (
    <Component size={17} variant="Linear" color="currentColor" aria-hidden="true" />
  ) : null;
}

// Map actions use the lighter Iconsax Linear variant. Other icons remain Bold.
function MapControlIcon({ name, size = 20 }) {
  const Component = name === 'fit-country'
    ? (Iconsax.Maximize4 || Iconsax.Maximize || Iconsax.Scan)
    : (name === 'plus' ? Iconsax.Add : Iconsax.Minus);

  if (Component) {
    return <Component size={size} variant="Linear" color="currentColor" aria-hidden="true" />;
  }

  // Fallback for older iconsax-react releases: four framed corners, not refresh.
  if (name === 'fit-country') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
        strokeLinejoin="round" aria-hidden="true">
        <path d="M8 4H4v4 M16 4h4v4 M20 16v4h-4 M8 20H4v-4" />
      </svg>
    );
  }
  return <span aria-hidden="true">{name === 'plus' ? '+' : '−'}</span>;
}
const STATION_ICON = renderToStaticMarkup(
  React.createElement(Iconsax.Electricity, { size: 17, variant: 'Bold', color: 'currentColor', 'aria-hidden': true }),
);


function formatNum(value) {
  return NUMBER.format(value || 0);
}

function pinIcon(kind, selected = false, count = 1) {
  const clustered = count > 1;
  const safeCount = Math.max(1, Math.min(Number(count) || 1, 9999));
  return L.divIcon({
    className: 'myev-charge-leaflet-pin',
    html: `<span class="myev-charge-pin ${clustered ? 'is-cluster' : ''} ${selected ? 'is-selected' : ''} is-${kind}">${clustered ? safeCount : `<span class="myev-charge-bolt">${STATION_ICON}</span>`}</span>`,
    iconSize: [clustered ? 42 : 30, clustered ? 42 : 30],
    iconAnchor: [clustered ? 21 : 15, clustered ? 21 : 15],
  });
}

/**
 * Build the *inverse* geographic mask: a regional rectangle with a hole for
 * every Malaysian land polygon. The even-odd fill keeps Malaysia fully clear
 * while fading neighbouring countries, without obscuring charger markers.
 *
 * Geometry coordinates are GeoJSON [longitude, latitude], converted to
 * Leaflet [latitude, longitude]. Use exterior rings only: interior holes
 * (such as lakes) should remain outside the unmasked land area.
 */
function malaysiaLandHoles(geojson) {
  if (geojson?.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) return [];
  const holes = [];

  function collectGeometry(geometry) {
    if (!geometry) return;
    if (geometry.type === 'GeometryCollection') {
      (geometry.geometries || []).forEach(collectGeometry);
      return;
    }
    const polygons = geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];

    for (const polygon of polygons) {
      const exterior = polygon?.[0];
      if (!Array.isArray(exterior) || exterior.length < 4) continue;
      const vertices = exterior
        .filter((coordinate) => Array.isArray(coordinate) && coordinate.length >= 2)
        .map(([longitude, latitude]) => [Number(latitude), Number(longitude)])
        .filter(([latitude, longitude]) =>
          Number.isFinite(latitude) && Number.isFinite(longitude) &&
          latitude >= -25 && latitude <= 30 && longitude >= 70 && longitude <= 145
        );
      if (vertices.length >= 4) holes.push(vertices);
    }
  }

  geojson.features.forEach((feature) => collectGeometry(feature?.geometry));
  return holes;
}

function safeStations(data) {
  return (Array.isArray(data?.stations) ? data.stations : [])
    .filter((s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)))
    .filter((s) => Number(s.lat) >= 0.6 && Number(s.lat) <= 8.8 && Number(s.lng) >= 99 && Number(s.lng) <= 120)
    .map((s) => ({
      ...s,
      id: String(s.id),
      lat: Number(s.lat),
      lng: Number(s.lng),
      name: String(s.name || 'Unnamed charging location'),
      operator: String(s.operator || 'Operator not recorded'),
      state: String(s.state || 'State not recorded'),
      state_source: String(s.state_source || ''),
      city: String(s.city || ''),
      address: String(s.address || ''),
      connectors: Array.isArray(s.connectors) ? s.connectors.map(String) : [],
      ac: Boolean(s.ac),
      dc: Boolean(s.dc),
      power_kw: s.power_kw === null || s.power_kw === undefined ? null : Number(s.power_kw),
      access: String(s.access || ''),
    }));
}

function classify(s) {
  if (s.dc) return 'dc';
  if (s.ac) return 'ac';
  return 'unknown';
}

function getBounds(stations) {
  const points = stations.map((s) => [s.lat, s.lng]);
  return points.length ? L.latLngBounds(points) : COUNTRY_BOUNDS;
}

function InfoItem({ label, children }) {
  return (
    <div className="myev-charge-info-item">
      <span>{label}</span>
      <strong>{children || 'Not recorded'}</strong>
    </div>
  );
}

export default function MalaysiaChargingStations() {
  const [dataset, setDataset] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [connectorFilter, setConnectorFilter] = useState('all');
  const [operatorFilter, setOperatorFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [zoom, setZoom] = useState(6);

  const mapHost = useRef(null);
  const map = useRef(null);
  const pins = useRef(null);
  const filteredRef = useRef([]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(DATA_URL, { signal: controller.signal, cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`Charging dataset not installed (HTTP ${response.status}).`);
        return response.json();
      })
      .then((payload) => {
        if (!Array.isArray(payload?.stations)) throw new Error('The charging data file has an invalid format.');
        setDataset({ ...payload, stations: safeStations(payload) });
        setError('');
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const allStations = dataset?.stations || [];
  const stateOptions = useMemo(() => [...new Set(allStations.map((s) => s.state))].sort(), [allStations]);
  const operatorOptions = useMemo(() => [...new Set(allStations.map((s) => s.operator))].sort(), [allStations]);
  const connectorOptions = useMemo(() => [...new Set(allStations.flatMap((s) => s.connectors))].sort(), [allStations]);

  const filtered = useMemo(() => {
    const needle = search.toLocaleLowerCase().trim();
    return allStations.filter((s) => {
      if (stateFilter !== 'all' && s.state !== stateFilter) return false;
      if (operatorFilter !== 'all' && s.operator !== operatorFilter) return false;
      if (connectorFilter !== 'all' && !s.connectors.includes(connectorFilter)) return false;
      if (typeFilter === 'dc' && !s.dc) return false;
      if (typeFilter === 'ac' && !s.ac) return false;
      if (typeFilter === 'unknown' && (s.ac || s.dc)) return false;
      if (!needle) return true;
      return [s.name, s.address, s.city, s.state, s.operator, s.connectors.join(' ')].join(' ').toLocaleLowerCase().includes(needle);
    });
  }, [allStations, search, stateFilter, typeFilter, connectorFilter, operatorFilter]);

  const selected = useMemo(() => filtered.find((s) => s.id === selectedId) || null, [filtered, selectedId]);
  const stats = useMemo(() => ({
    dc: filtered.filter((s) => s.dc).length,
    ac: filtered.filter((s) => s.ac).length,
    powered: filtered.filter((s) => Number.isFinite(s.power_kw) && s.power_kw > 0).length,
  }), [filtered]);

  const ranking = useMemo(() => {
    const groups = new Map();
    filtered.forEach((s) => groups.set(s.state, (groups.get(s.state) || 0) + 1));
    return [...groups].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [filtered]);

  const resetFilters = () => {
    setSearch('');
    setStateFilter('all');
    setTypeFilter('all');
    setConnectorFilter('all');
    setOperatorFilter('all');
    setVisibleCount(12);
    setSelectedId(null);
    // Clearing filters should also restore the full West + East Malaysia view.
    const scene = map.current;
    if (scene) {
      scene.stop();
      scene.invalidateSize({ pan: false });
      scene.flyToBounds(COUNTRY_BOUNDS, { padding: [24, 24], duration: 0.65 });
    }
  };

  useEffect(() => {
    if (!mapHost.current || map.current) return undefined;
    const scene = L.map(mapHost.current, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true,
      wheelDebounceTime: 40,
      wheelPxPerZoomLevel: 90,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      preferCanvas: true,
      minZoom: 4,
      maxZoom: 18,
    });
    scene.fitBounds(COUNTRY_BOUNDS, { padding: [10, 10] });
    L.tileLayer(TILE_URL, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      maxZoom: 19,
      className: 'myev-charge-tiles',
    }).addTo(scene);

    // Soft-focus everything outside Malaysia without modifying the map tiles,
    // country boundary data, map controls, site pins, or mouse interactions.
    // Pane order: tiles (200) -> dimming (340) -> pins (600) / UI controls.
    const dimPane = scene.createPane(MALAYSIA_DIM_PANE);
    dimPane.style.zIndex = '340';
    dimPane.style.pointerEvents = 'none';
    const boundaryController = new AbortController();
    fetch(BOUNDARIES_URL, { signal: boundaryController.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`State boundaries unavailable (HTTP ${response.status})`);
        return response.json();
      })
      .then((geojson) => {
        if (boundaryController.signal.aborted || map.current !== scene) return;
        const holes = malaysiaLandHoles(geojson);
        if (!holes.length) throw new Error('No valid Malaysian land polygons');
        L.polygon([REGIONAL_FRAME, ...holes], {
          pane: MALAYSIA_DIM_PANE,
          renderer: L.svg({ pane: MALAYSIA_DIM_PANE, padding: 0.5 }),
          fillColor: '#f8f9f7',
          fillOpacity: 0.76,
          fillRule: 'evenodd',
          stroke: false,
          interactive: false,
          className: 'myev-charge-country-focus',
        }).addTo(scene);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          // The map stays fully usable and unmasked if the boundary file is missing.
          console.warn('[MyEV Charging] Country focus unavailable:', err.message);
        }
      });

    pins.current = L.layerGroup().addTo(scene);
    map.current = scene;
    setZoom(scene.getZoom());
    setMapReady(true);
    scene.on('zoomend', () => setZoom(scene.getZoom()));
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => scene.invalidateSize({ pan: false })) : null;
    observer?.observe(mapHost.current);
    const frame = requestAnimationFrame(() => {
      scene.invalidateSize({ pan: false });
      // Use the complete country viewport on reload, even if all recorded
      // charging locations in the current snapshot happen to be in West Malaysia.
      scene.fitBounds(COUNTRY_BOUNDS, { padding: [24, 24], animate: false });
    });
    return () => {
      boundaryController.abort();
      cancelAnimationFrame(frame);
      observer?.disconnect();
      scene.remove();
      map.current = null;
      pins.current = null;
      setMapReady(false);
    };
  }, []);

  const drawPins = useCallback(() => {
    const scene = map.current;
    const group = pins.current;
    if (!scene || !group) return;
    group.clearLayers();
    if (!filteredRef.current.length) return;

    // Screen-grid clustering without a markercluster dependency.
    // At street zooms all sites become individual selectable markers.
    const cluster = scene.getZoom() < 11;
    const buckets = new Map();
    filteredRef.current.forEach((site) => {
      const pixel = scene.project([site.lat, site.lng], scene.getZoom());
      const cell = cluster ? `${Math.floor(pixel.x / 50)}:${Math.floor(pixel.y / 50)}` : site.id;
      const bucket = buckets.get(cell) || [];
      bucket.push(site);
      buckets.set(cell, bucket);
    });

    for (const bucket of buckets.values()) {
      if (bucket.length === 1) {
        const site = bucket[0];
        L.marker([site.lat, site.lng], {
          icon: pinIcon(classify(site), site.id === selectedId, 1),
          title: site.name,
          keyboard: true,
        }).on('click', () => setSelectedId(site.id)).addTo(group);
        continue;
      }
      const lat = bucket.reduce((sum, s) => sum + s.lat, 0) / bucket.length;
      const lng = bucket.reduce((sum, s) => sum + s.lng, 0) / bucket.length;
      const marker = L.marker([lat, lng], {
        icon: pinIcon('cluster', false, bucket.length),
        title: `${bucket.length} charging locations`,
        keyboard: true,
      });
      marker.on('click', () => {
        const bounds = getBounds(bucket);
        if (bounds.isValid() && bounds.getNorthEast().distanceTo(bounds.getSouthWest()) > 30) {
          scene.flyToBounds(bounds, { maxZoom: 14, padding: [30, 30], duration: 0.65 });
        } else {
          scene.flyTo([lat, lng], Math.min(15, scene.getZoom() + 2), { duration: 0.6 });
        }
      });
      marker.addTo(group);
    }
  }, [selectedId]);

  useEffect(() => { filteredRef.current = filtered; drawPins(); }, [filtered, drawPins, zoom, mapReady]);
  useEffect(() => {
    if (selectedId && !filtered.some((s) => s.id === selectedId)) setSelectedId(null);
  }, [filtered, selectedId]);
  useEffect(() => {
    // Only a deliberate filter selection may zoom the map to station bounds.
    // On first load (all filters cleared), keep the complete Malaysia view.
    const hasActiveFilter = Boolean(search.trim()) || stateFilter !== 'all' ||
      typeFilter !== 'all' || connectorFilter !== 'all' || operatorFilter !== 'all';
    if (!hasActiveFilter || !mapReady || !map.current || !filtered.length) return undefined;
    const timer = setTimeout(() => {
      map.current?.flyToBounds(getBounds(filtered), {
        padding: [30, 30], maxZoom: 12, duration: 0.6,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, stateFilter, typeFilter, connectorFilter, operatorFilter, filtered, mapReady]);
  useEffect(() => {
    if (!selected || !map.current) return;
    const scene = map.current;
    if (!scene.getBounds().contains([selected.lat, selected.lng]) || scene.getZoom() < 12) {
      scene.flyTo([selected.lat, selected.lng], Math.max(13, scene.getZoom()), { duration: 0.65 });
    }
  }, [selected]);

  // Return to a full-country map even when a state/station filter is active.
  // COUNTRY_BOUNDS covers both Peninsular and East Malaysia.
  const fitMalaysia = () => {
    const scene = map.current;
    if (!scene) return;
    scene.stop();
    scene.invalidateSize({ pan: false });
    scene.flyToBounds(COUNTRY_BOUNDS, {
      padding: [24, 24],
      duration: 0.7,
    });
  };

  const generatedAt = dataset?.meta?.generated_at
    ? new Date(dataset.meta.generated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Not available';

  return (
    <div className="myev-charge-page">
      <header className="myev-charge-hero">
        <div>
          <span className="myev-charge-eyebrow">GEOSPATIAL / EV INFRASTRUCTURE</span>
          <h1>Malaysia EV charging stations<span className="myev-charge-accent">.</span></h1>
          <p>Find recorded charging locations across Malaysia. Explore connection types, network operators and regional coverage.</p>
        </div>
        <div className="myev-charge-source-pill">OPENSTREETMAP DATA · {generatedAt}</div>
      </header>

      <section className="myev-charge-guide" aria-label="How to use the charging map">
        <div><b>01</b><span>Search a city, location or operator</span></div>
        <div><b>02</b><span>Filter AC / DC, state and connector</span></div>
        <div><b>03</b><span>Select a marker for station details</span></div>
      </section>

      <section className="myev-charge-filters" aria-label="Charging station filters">
        <label className="myev-charge-field myev-charge-search"><span>SEARCH LOCATIONS</span>
          <input type="search" value={search} placeholder="Station, city or address" onChange={(event) => { setSearch(event.target.value); setVisibleCount(12); }} />
        </label>
        <label className="myev-charge-field"><span>STATE</span>
          <select value={stateFilter} onChange={(event) => { setStateFilter(event.target.value); setVisibleCount(12); }}>
            <option value="all">All states</option>
            {stateOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className="myev-charge-field"><span>CHARGING TYPE</span>
          <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setVisibleCount(12); }}>
            {Object.entries(LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="myev-charge-field"><span>CONNECTOR</span>
          <select value={connectorFilter} onChange={(event) => { setConnectorFilter(event.target.value); setVisibleCount(12); }}>
            <option value="all">All connectors</option>
            {connectorOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className="myev-charge-field"><span>OPERATOR</span>
          <select value={operatorFilter} onChange={(event) => { setOperatorFilter(event.target.value); setVisibleCount(12); }}>
            <option value="all">All operators</option>
            {operatorOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <button type="button" className="myev-charge-clear" onClick={resetFilters}>Clear filters</button>
      </section>

      <section className="myev-charge-kpis" aria-label="Filtered charging station summary">
        <div><span>RECORDED LOCATIONS</span><strong>{formatNum(filtered.length)}</strong><small>Matches current filters</small></div>
        <div><span>DC IDENTIFIED</span><strong>{formatNum(stats.dc)}</strong><small>Explicit DC connector records</small></div>
        <div><span>AC IDENTIFIED</span><strong>{formatNum(stats.ac)}</strong><small>Explicit AC connector records</small></div>
        <div><span>POWER RECORDED</span><strong>{filtered.length ? `${Math.round(stats.powered / filtered.length * 100)}%` : '—'}</strong><small>Sites with usable kW details</small></div>
      </section>

      <div className="myev-charge-main">
        <section className="myev-charge-map-card">
          <div className="myev-charge-card-head">
            <div><span className="myev-charge-eyebrow">01 / INTERACTIVE MAP</span><h2>Explore the network<span className="myev-charge-accent">.</span></h2></div>
            <span className="myev-charge-head-note">Recorded sites · not live availability</span>
          </div>
          <div className="myev-charge-map-wrap">
            <div className="myev-charge-map" ref={mapHost} aria-label="Interactive map of EV charging locations in Malaysia" />
            <div className="myev-charge-map-top">MALAYSIA / STATION LOCATIONS</div>
            <div className="myev-charge-map-actions" role="group" aria-label="Map zoom and view controls">
              <button
                type="button"
                title="Zoom in"
                aria-label="Zoom in"
                onClick={() => map.current?.zoomIn()}
              >
                <MapControlIcon name="plus" size={20} />
              </button>
              <button
                type="button"
                title="Zoom out"
                aria-label="Zoom out"
                onClick={() => map.current?.zoomOut()}
              >
                <MapControlIcon name="minus" size={20} />
              </button>
              <button
                type="button"
                title="Fit entire Malaysia — West and East"
                aria-label="Show all Malaysia, including Peninsular Malaysia and Borneo"
                onClick={fitMalaysia}
                className="myev-charge-map-fit"
              >
                <MapControlIcon name="fit-country" size={19} />
              </button>
            </div>
            {loading && <div className="myev-charge-overlay">Loading charging station data…</div>}
            {!loading && error && (
              <div className="myev-charge-overlay myev-charge-error">
                <strong>Charging station dataset is not connected yet.</strong>
                <p>Run <code>python tools/prepare_myev_charging_stations.py</code> in the MyEV project folder, then refresh.</p>
                <small>{error}</small>
              </div>
            )}
            {!loading && !error && filtered.length === 0 && <div className="myev-charge-overlay">No recorded locations match these filters.</div>}
          </div>
          <div className="myev-charge-map-key">
            <span><i className="myev-charge-key-dot is-ac"/> AC / unspecified</span>
            <span><i className="myev-charge-key-dot is-dc"/> DC recorded</span>
            <span><i className="myev-charge-key-dot is-selected"/> Selected location</span>
            <span>Cluster numbers indicate recorded sites</span>
          </div>
        </section>

        <aside className="myev-charge-detail-card">
          <div className="myev-charge-card-head"><div><span className="myev-charge-eyebrow">02 / LOCATION DETAILS</span><h2>Selected station<span className="myev-charge-accent">.</span></h2></div></div>
          {selected ? (
            <div className="myev-charge-station-detail">
              <div className="myev-charge-selected-name"><span className="myev-charge-mini-icon"><BoldIcon name="Electricity" size={20} /></span><div><h3>{selected.name}</h3><p>{[selected.city, selected.state].filter(Boolean).join(' · ')}</p>{selected.state_source === 'coordinate_boundary' && <small className="myev-charge-geo-source">State located using published administrative boundaries</small>}</div></div>
              <div className="myev-charge-detail-tags">
                {selected.dc && <span>DC recorded</span>}{selected.ac && <span>AC recorded</span>}
                {!selected.ac && !selected.dc && <span>Charger type unknown</span>}
                {Number.isFinite(selected.power_kw) && selected.power_kw > 0 && <span>{selected.power_kw} kW max recorded</span>}
              </div>
              <div className="myev-charge-info-grid">
                <InfoItem label="OPERATOR">{selected.operator}</InfoItem>
                <InfoItem label="CONNECTORS">{selected.connectors.length ? selected.connectors.join(', ') : 'Not recorded'}</InfoItem>
                <InfoItem label="ADDRESS">{selected.address || [selected.city, selected.state].filter(Boolean).join(', ')}</InfoItem>
                <InfoItem label="ACCESS">{selected.access || 'Not recorded'}</InfoItem>
              </div>
              <div className="myev-charge-station-links">
                <a target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${selected.lat}%2C${selected.lng}`}>
                  <span>Open directions</span>
                  <StationLinkIcon kind="directions" />
                </a>
                <a target="_blank" rel="noopener noreferrer" href={selected.osm_url || `https://www.openstreetmap.org/?mlat=${selected.lat}&mlon=${selected.lng}`}>
                  <span>OSM record</span>
                  <StationLinkIcon kind="record" />
                </a>
              </div>
              <button type="button" className="myev-charge-unselect" onClick={() => setSelectedId(null)}>Close details</button>
            </div>
          ) : (
            <div className="myev-charge-detail-placeholder">
              <span className="myev-charge-placeholder-glyph"><BoldIcon name="Location" size={25}/></span>
              <h3>Select a charging location</h3><p>Select a charging station marker on the map to view its connector, power, operator and location details here.</p>
            </div>
          )}
        </aside>
      </div>

      <div className="myev-charge-lower">
        <section className="myev-charge-lower-card">
          <span className="myev-charge-eyebrow">03 / GEOGRAPHIC COVERAGE</span>
          <h2>Recorded sites by state<span className="myev-charge-accent">.</span></h2>
          <p>Relative distribution of locations included in the selected OpenStreetMap snapshot.</p>
          <div className="myev-charge-ranking">
            {ranking.map(([state, count], index) => (
              <button type="button" key={state} className="myev-charge-ranking-row" onClick={() => setStateFilter(state)}>
                <span>{String(index + 1).padStart(2, '0')}</span><strong>{state}</strong>
                <i><em style={{ width: `${ranking[0]?.[1] ? count / ranking[0][1] * 100 : 0}%` }} /></i>
                <b>{formatNum(count)}</b>
              </button>
            ))}
            {ranking.length === 0 && <p>No sites available for these filters.</p>}
          </div>
        </section>
        <section className="myev-charge-lower-card myev-charge-interpretation">
          <span className="myev-charge-eyebrow">DATA QUALITY / INTERPRETATION</span>
          <h2>What this dataset tells us<span className="myev-charge-accent">.</span></h2>
          <div className="myev-charge-info-section"><h3>Included</h3><p>OpenStreetMap features recorded as <code>amenity=charging_station</code> with usable Malaysian coordinates.</p></div>
          <div className="myev-charge-info-section"><h3>Not included</h3><p>Real-time charger availability, guaranteed access, charging prices, or a complete official national inventory.</p></div>
          <div className="myev-charge-info-section"><h3>Data quality</h3><p>Connector, operator, state and power fields may be missing. AC and DC totals can overlap when one location supports both.</p></div>
          <div className="myev-charge-credit">© OpenStreetMap contributors · ODbL · snapshot {generatedAt}. Verify access and availability with the station operator before travel.</div>
        </section>
      </div>
    </div>
  );
}
