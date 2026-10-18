import React, { useEffect, useMemo, useState } from 'react';
import StateChoroplethMap from './StateChoroplethMap.jsx';
import './OverviewGeoSnapshot.css';

const format = (value) =>
  Number.isFinite(value) ? new Intl.NumberFormat('en-MY').format(value) : '—';

const pct = (value) =>
  Number.isFinite(value) ? `${value.toFixed(1)}%` : '—';

/**
 * Overview geographic preview uses the same officially sourced, processed
 * transaction dataset as the full Geographic Explorer. It NEVER presents
 * known-state records as resident EV ownership or true state penetration.
 */
export default function OverviewGeoSnapshot() {
  const [dataset, setDataset] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState('Johor');

  useEffect(() => {
    const controller = new AbortController();

    fetch('/data/jpj_geographic_2026.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('JPJ state snapshot unavailable');
        return response.json();
      })
      .then(setDataset)
      .catch((error) => {
        if (error.name !== 'AbortError') setLoadError(true);
      });

    return () => controller.abort();
  }, []);

  const latestMonth = dataset?.meta?.cutoff || dataset?.meta?.months?.at(-1);

  const coverage = useMemo(
    () => (dataset?.coverage || []).find((row) => row.month === latestMonth),
    [dataset, latestMonth]
  );

  const stateRows = useMemo(
    () => (dataset?.states || []).filter((row) => row.month === latestMonth),
    [dataset, latestMonth]
  );

  const stateValues = useMemo(
    () => Object.fromEntries(stateRows.map((row) => [row.state, row.ev])),
    [stateRows]
  );

  const activeState = stateRows.find((row) => row.state === selected);

  const monthLabel = latestMonth
    ? new Date(`${latestMonth}-01T00:00:00`).toLocaleDateString('en-GB', {
        month: 'short',
        year: 'numeric'
      })
    : 'Latest reported month';

  return (
    <div className="vg7-overview-preview">
      <div className="vg7-map-intro">
        <div className="vg7-map-explanation">
          <span className="vg7-small-label">WHAT THIS MAP SHOWS</span>
          <p>
            EV registration records linked to a known state.
            Grey shades compare reported counts, not EV ownership or regional adoption rates.
          </p>
        </div>
        <div className="vg7-quick-stats" aria-label="Geographic data coverage">
          <div className="vg7-quick-stat">
            <strong>{format(coverage?.known_state)}</strong>
            <span>State-linked records</span>
          </div>
          <div className="vg7-quick-stat">
            <strong>{pct(coverage?.coverage_pct)}</strong>
            <span>Records assigned</span>
          </div>
        </div>
      </div>

      <div className="vg7-map-window">
        <StateChoroplethMap
          compact
          selected={selected}
          onSelect={setSelected}
          metricValues={stateValues}
        />
        <span className="vg7-map-layer-badge">EV REGISTRATIONS · {monthLabel.toUpperCase()}</span>
      </div>

      <div className="vg7-map-context">
        <div className="vg7-selected-state">
          <span className="vg7-selected-mark" aria-hidden="true" />
          <div>
            <span className="vg7-small-label">SELECTED REGISTRATION STATE</span>
            <strong>{selected}</strong>
          </div>
        </div>
        <div className="vg7-selected-value">
          <strong>{format(activeState?.ev)}</strong>
          <span>EV registrations</span>
        </div>
        <div className="vg7-selected-value">
          <strong>{pct(activeState?.ev_share)}</strong>
          <span>EV share of known-state records</span>
        </div>
      </div>

      <p className="vg7-caveat">
        {loadError
          ? 'The processed state dataset is not connected. Install the v5 dataset to display regional figures.'
          : `Source: JPJ 2026 transactions · ${monthLabel}. Unallocated/Rakan Niaga records are excluded from state comparisons.`}
      </p>
    </div>
  );
}
