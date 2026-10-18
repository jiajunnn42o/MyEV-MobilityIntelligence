import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// MyEV — DATA-DRIVEN STATE CHOROPLETH (v5)
// Geographic reference locations only: these are NOT state EV statistics.
const CITY_STATE = { 'Kuala Lumpur': 'W.P. Kuala Lumpur', 'Johor Bahru': 'Johor', 'George Town': 'Pulau Pinang', 'Kuching': 'Sarawak', 'Kota Kinabalu': 'Sabah' };

const CITIES = [
  { name: 'Kuala Lumpur', lat: 3.1390, lng: 101.6869 },
  { name: 'Johor Bahru', lat: 1.4927, lng: 103.7414 },
  { name: 'George Town', lat: 5.4141, lng: 100.3288 },
  { name: 'Kuching', lat: 1.5535, lng: 110.3593 },
  { name: 'Kota Kinabalu', lat: 5.9804, lng: 116.0735 }
];

const NATIONAL_BOUNDS = L.latLngBounds([0.7, 99.0], [8.7, 119.8]);
const STATE_DATA_LOCAL = '/data/malaysia-states.geojson';
const STATE_DATA_REMOTE = 'https://raw.githubusercontent.com/dosm-malaysia/data-open/main/datasets/geodata/administrative_1_state.geojson';
const TILE_LIGHT = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const normalize = (value) => String(value || '')
  .normalize('NFKD')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

function canonicalStateName(name) {
  const aliases = {
    kualalumpur: 'W.P. Kuala Lumpur',
    wpkualalumpur: 'W.P. Kuala Lumpur',
    federalterritoryofkualalumpur: 'W.P. Kuala Lumpur',
    penang: 'Pulau Pinang',
    pulaupinang: 'Pulau Pinang',
    malacca: 'Melaka',
    negerisembilan: 'Negeri Sembilan'
  };
  return aliases[normalize(name)] || name;
}

function getStateName(feature) {
  const props = feature?.properties || {};
  const name = props.state || props.name || props.NAME_1 || props.NAME || props.STATE_NAME || props.state_name ||
    props.nam || props.NAM || props.State || props.STATE;
  if (!name) return 'Unnamed state';
  const words = String(name).toLowerCase().split(/\s+/g);
  return canonicalStateName(words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '));
}

function markerIcon(active) {
  return L.divIcon({
    className: 'vm-marker-shell',
    html: `<span class="vm-map-pin${active ? ' is-active' : ''}"></span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

function metricValue(name, values) {
  const canonical = normalize(name).replace(/^wp/, '').replace(/^wilayahpersekutuan/, '');
  const entry = Object.entries(values || {}).find(([key]) => {
    const normalized = normalize(key).replace(/^wp/, '').replace(/^wilayahpersekutuan/, '');
    return normalized === canonical;
  });
  return entry ? entry[1] : null;
}

function countryStyle(isSelected = false, value = null, peak = 1) {
  const isAvailable = Number.isFinite(value);
  const strength = isAvailable && peak > 0 ? Math.min(1, Math.max(0, value / peak)) : 0;
  // No color implies no reported data. Greys mean measured, allocated registrations.
  const fills = ['#EDF0EC', '#DCE0DC', '#C6CDC7', '#A9B3AC', '#849088'];
  const fill = isAvailable ? fills[Math.min(4, Math.floor(strength * 4.999))] : '#F9FAF8';
  return {
    color: isSelected ? '#171918' : '#939D95',
    weight: isSelected ? 2.5 : 1.15,
    fillColor: isSelected ? '#A9FF19' : fill,
    fillOpacity: isSelected ? .88 : isAvailable ? .83 : .38,
    lineJoin: 'round', opacity: 1
  };
}


/**
 * Build an inverted Malaysia focus polygon.
 * Each official state/multi-island polygon becomes a transparent hole.
 * A pale overlay dims geography outside Malaysia while preserving state
 * borders, roads and labels inside the country.
 *
 * No hand-drawn boundaries or fabricated adoption values are used.
 */
function getMalaysiaFocusHoles(collection) {
  const holes = [];

  function addExterior(polygonCoordinates) {
    const outerRing = polygonCoordinates?.[0];
    if (!Array.isArray(outerRing) || outerRing.length < 4) return;

    holes.push(
      outerRing.map(([longitude, latitude]) => [latitude, longitude])
    );
  }

  for (const feature of collection.features || []) {
    const geometry = feature.geometry;
    if (!geometry) continue;

    if (geometry.type === 'Polygon') {
      addExterior(geometry.coordinates);
    } else if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach(addExterior);
    }
  }

  return holes;
}

async function getBoundaries(signal) {
  // Local file first; online official source as fallback.
  for (const url of [STATE_DATA_LOCAL, STATE_DATA_REMOTE]) {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) continue;
      const geojson = await res.json();
      if (geojson?.type === 'FeatureCollection' && geojson.features?.length) {
        return geojson;
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
    }
  }
  throw new Error('Malaysia state boundaries could not be loaded');
}

/**
 * MyEV Geographic Explorer / Overview preview.
 * - Uses real DOSM state polygons, no fabricated state metrics.
 * - Bounded, animated state focus and city focus.
 * - Resizes automatically inside cards, panels and mobile layouts.
 * - If map tiles fail, local boundaries are still usable.
 */
export default function StateChoroplethMap({ selected = 'Johor', onSelect, metricValues = {}, compact = false }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileRef = useRef(null);
  const geoRef = useRef(null);
  const outsideMaskRef = useRef(null);
  const citiesRef = useRef({});
  const onSelectRef = useRef(onSelect);
  const selectionRef = useRef(selected);
  const metricValuesRef = useRef(metricValues);
  const [style, setStyle] = useState('light');
  const [boundaryStatus, setBoundaryStatus] = useState('loading');
  const [tileFailed, setTileFailed] = useState(false);
  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { selectionRef.current = selected; }, [selected]);
  useEffect(() => { metricValuesRef.current = metricValues; }, [metricValues]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const controller = new AbortController();
    const scene = L.map(el, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: !compact,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      minZoom: 3,
      maxZoom: 17,
      preferCanvas: true
    });
    mapRef.current = scene;

    // Separate panes make the outside haze sit between basemap and state lines.
    scene.createPane('vm-country-mask');
    scene.getPane('vm-country-mask').style.zIndex = '380';
    scene.getPane('vm-country-mask').style.pointerEvents = 'none';

    scene.createPane('vm-state-boundaries');
    scene.getPane('vm-state-boundaries').style.zIndex = '425';

    // Explicit SVG renderers preserve the outside cutout (evenodd) and
    // clickable state polygons even though the map prefers canvas.
    const maskRenderer = L.svg({ pane: 'vm-country-mask' });
    const stateRenderer = L.svg({ pane: 'vm-state-boundaries' });

    scene.fitBounds(NATIONAL_BOUNDS, { padding: compact ? [12, 12] : [25, 25] });

    if (!compact) L.control.zoom({ position: 'bottomright' }).addTo(scene);

    const base = L.tileLayer(TILE_LIGHT, {
      attribution: ATTRIBUTION,
      maxZoom: 19
    });
    let tileErrors = 0;
    base.on('tileerror', () => {
      tileErrors += 1;
      if (tileErrors >= 5) setTileFailed(true);
    });
    base.on('tileload', () => { tileErrors = 0; setTileFailed(false); });
    base.addTo(scene);
    tileRef.current = base;

    CITIES.forEach(city => {
      const point = L.marker([city.lat, city.lng], {
        icon: markerIcon(city.name === selectionRef.current),
        title: city.name,
        keyboard: true
      }).addTo(scene);
      point.bindTooltip(city.name, {
        direction: 'top',
        offset: [0, -10],
        className: 'vm-place-tooltip'
      });
      point.on('click', () => onSelectRef.current?.(CITY_STATE[city.name] || city.name));
      citiesRef.current[city.name] = point;
    });

    let stateGroup;
    getBoundaries(controller.signal).then(geojson => {
      if (controller.signal.aborted || mapRef.current !== scene) return;
      const worldFrame = [
        [-85, -179],
        [-85, 179],
        [85, 179],
        [85, -179]
      ];

      const holes = getMalaysiaFocusHoles(geojson);
      const focusMask = L.polygon([worldFrame, ...holes], {
        pane: 'vm-country-mask',
        renderer: maskRenderer,
        stroke: false,
        fill: true,
        fillColor: '#F7F8F6',
        fillOpacity: 0.86,
        fillRule: 'evenodd',
        interactive: false,
        smoothFactor: 0.2
      }).addTo(scene);

      outsideMaskRef.current = focusMask;

      stateGroup = L.geoJSON(geojson, {
        pane: 'vm-state-boundaries',
        renderer: stateRenderer,
        style: feature => countryStyle(
          normalize(getStateName(feature)) === normalize(selectionRef.current),
          metricValue(getStateName(feature), metricValuesRef.current),
          Math.max(1, ...Object.values(metricValuesRef.current).filter(Number.isFinite))
        ),
        onEachFeature: (feature, layer) => {
          const name = getStateName(feature);
          layer._volterraName = name;
          layer.bindTooltip(name, {
            sticky: true,
            direction: 'top',
            className: 'vm-place-tooltip'
          });
          layer.on('mouseover', () => {
            if (normalize(name) === normalize(selectionRef.current)) return;
            layer.setStyle({ fillColor: '#B6C0B9', fillOpacity: .92, weight: 1.9, color: '#606860' });
          });
          layer.on('mouseout', () => {
            layer.setStyle(countryStyle(
              normalize(name) === normalize(selectionRef.current),
              metricValue(name, metricValuesRef.current),
              Math.max(1, ...Object.values(metricValuesRef.current).filter(Number.isFinite))
            ));
          });
          layer.on('click', () => onSelectRef.current?.(name));
        }
      }).addTo(scene);
      geoRef.current = stateGroup;
      if (stateGroup.getBounds().isValid()) {
        scene.fitBounds(stateGroup.getBounds(), {
          padding: compact ? [15, 15] : [33, 33]
        });
      }
      // Layer order: basemap < outside haze < state boundaries < markers.
      setBoundaryStatus('ready');
    }).catch(err => {
      if (err.name === 'AbortError') return;
      setBoundaryStatus('unavailable');
      console.warn('[MyEV] Real state boundaries unavailable:', err.message);
    });

    let raf = 0;
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => {
            if (mapRef.current === scene) scene.invalidateSize({ pan: false });
          });
        })
      : null;
    if (observer) observer.observe(el.parentElement || el);

    return () => {
      controller.abort();
      observer?.disconnect();
      cancelAnimationFrame(raf);
      scene.remove();
      mapRef.current = null;
      geoRef.current = null;
      outsideMaskRef.current = null;
      tileRef.current = null;
      citiesRef.current = {};
    };
    // Deliberately initialize once; selection and style have separate effects.
  }, [compact]);

  useEffect(() => {
    const scene = mapRef.current;
    if (!scene) return;
    Object.entries(citiesRef.current).forEach(([name, marker]) => {
      marker.setIcon(markerIcon(normalize(name) === normalize(selected)));
    });

    const stateGroup = geoRef.current;
    let selectedState = null;
    stateGroup?.eachLayer(layer => {
      const active = normalize(layer._volterraName) === normalize(selected);
      layer.setStyle(countryStyle(
        active, metricValue(layer._volterraName, metricValues),
        Math.max(1, ...Object.values(metricValues).filter(Number.isFinite))
      ));
      if (active) selectedState = layer;
    });
    selectedState?.bringToFront();

    // Initial map load stays at Malaysia-wide view; only explicit selection flies.
    if (selected === undefined || selected === null) return;
    const previous = scene._volterraSelection;
    scene._volterraSelection = selected;
    if (!previous || normalize(previous) === normalize(selected)) return;
    const options = { animate: !reducedMotion(), duration: reducedMotion() ? 0 : 1.05 };
    if (selectedState?.getBounds()?.isValid()) {
      scene.flyToBounds(selectedState.getBounds(), {
        ...options, maxZoom: compact ? 7 : 9,
        padding: compact ? [18, 18] : [44, 44]
      });
    } else {
      const city = CITIES.find(item => normalize(item.name) === normalize(selected));
      if (city) scene.flyTo([city.lat, city.lng], compact ? 7 : 9, options);
    }
  }, [selected, boundaryStatus, compact, metricValues]);

  // Both modes use OSM tiles; CSS desaturates only the Minimal mode.
  // Avoid requesting a key-protected CARTO basemap.

  function resetMap() {
    const scene = mapRef.current;
    if (!scene) return;
    const bounds = geoRef.current?.getBounds()?.isValid()
      ? geoRef.current.getBounds() : NATIONAL_BOUNDS;
    scene.flyToBounds(bounds, {
      animate: !reducedMotion(),
      duration: reducedMotion() ? 0 : 1.1,
      padding: compact ? [14, 14] : [35, 35]
    });
  }

  return (
    <div
      className={`geospatial-map vm-geospatial-map ${compact ? 'is-compact' : ''} ${style === 'light' ? 'vm-map-minimal' : 'vm-map-street'}`}
    >
      <div
        ref={containerRef}
        className="geospatial-leaflet"
        aria-label="Interactive state registration choropleth for Malaysia; unallocated JPJ registrations are excluded"
      />
      <div className="vm-map-heading" aria-hidden="true">
        <span className="vm-map-status-dot" />
        <span>MALAYSIA / STATE REGISTRATIONS</span>
      </div>
      {!compact && (
        <div className="geo-style-controls" role="group" aria-label="Map basemap style">
          <button type="button" className={style === 'light' ? 'selected' : ''}
            onClick={() => setStyle('light')}>Minimal</button>
          <button type="button" className={style === 'street' ? 'selected' : ''}
            onClick={() => setStyle('street')}>Street</button>
        </div>
      )}
      {!compact && (
        <button
          type="button"
          className="vm-map-reset vm-map-reset-neutral"
          onClick={resetMap}
          aria-label="Reset view to Malaysia"
          title="Reset view to all of Malaysia"
        >
          <svg viewBox="0 0 24 24" width="17" height="17" stroke="currentColor"
            strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
          <span>Reset view</span>
        </button>
      )}
      {/* Overview-only native Leaflet zoom controls; no CSS/SVG scaling. */}
      {compact && (
        <div
          className="vm-overview-zoom-controls"
          role="group"
          aria-label="Map zoom controls"
        >
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn(0.5, {
              animate: !reducedMotion()
            })}
            aria-label="Zoom in map"
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut(0.5, {
              animate: !reducedMotion()
            })}
            aria-label="Zoom out map"
            title="Zoom out"
          >
            −
          </button>
        </div>
      )}
      <div className="vm-map-footer">
        <span>{boundaryStatus === 'ready' ? 'DOSM BOUNDARIES / JPJ KNOWN-STATE DATA' :
          boundaryStatus === 'loading' ? 'LOADING STATE BOUNDARIES…' :
          'STATE BOUNDARIES NOT LOADED'}</span>
        <span>REFERENCE LOCATIONS · 05</span>
      </div>
      {tileFailed && (
        <div className="vm-map-tile-warning">
          Map tiles unavailable. {boundaryStatus === 'ready'
            ? 'State boundaries remain usable.'
            : 'Check network connection.'}
        </div>
      )}
    </div>
  );
}
