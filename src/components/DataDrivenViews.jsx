import React, { useEffect, useMemo, useState } from 'react';
import StateChoroplethMap from './StateChoroplethMap.jsx';
import './DataDrivenViews.css';

import MyEVDataCoverage from './MyEVDataCoverage';
const ACCENT = '#A9FF19';
const formatter = new Intl.NumberFormat('en-MY');
const fmt = (n) => Number.isFinite(n) ? formatter.format(Math.round(n)) : '—';
const percent = (n, digits = 1) => Number.isFinite(n) ? `${n.toFixed(digits)}%` : '—';
const prettyMonth = (value) => new Date(`${value}-01T00:00:00`).toLocaleDateString(
  'en-GB', { month: 'short', year: 'numeric' }
);
const byNumber = (row, metric) => metric === 'ev_share' ? row.ev_share
  : metric === 'electrification_share' ? row.electrification_share
  : row[metric];

const metricOptions = [
  { value: 'ev', label: 'EV registrations', unit: 'vehicles' },
  { value: 'ev_share', label: 'EV share of known-state', unit: '%' },
  { value: 'hybrid', label: 'Hybrid registrations', unit: 'vehicles' },
  { value: 'electrification_share', label: 'Electrification share', unit: '%' }
];

function useJPJData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/data/jpj_geographic_2026.json', { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('Processed JPJ data is not installed.');
        return r.json();
      })
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, []);
  return { data, error };
}

function aggregate(items) {
  const c = { total: 0, ev: 0, hybrid: 0, petrol: 0, other: 0 };
  items.forEach((r) => {
    Object.keys(c).forEach((k) => { c[k] += r[k] || 0; });
  });
  return {
    ...c,
    ev_share: c.total ? (100 * c.ev / c.total) : null,
    electrification_share: c.total ? (100 * (c.ev + c.hybrid) / c.total) : null
  };
}

function filterRows(data, until, period, rows = data?.states || []) {
  if (!until) return [];
  return rows.filter((r) => period === 'month' ? r.month === until : r.month <= until);
}

function rowsByState(sourceRows) {
  const lookup = new Map();
  sourceRows.forEach((row) => {
    const group = lookup.get(row.state) || [];
    group.push(row);
    lookup.set(row.state, group);
  });
  return Array.from(lookup, ([state, rows]) => ({ state, ...aggregate(rows) }));
}

function StatusView({ error }) {
  return (
    <div className="vm5-unavailable">
      <span className="vm5-eyebrow">STATE DATA / SOURCE STATUS</span>
      <h2>{error ? 'Processed dataset not found.' : 'Preparing intelligence view…'}</h2>
      <p>{error || 'Loading locally aggregated JPJ registration data.'}</p>
      {error && <p>Run <code>python tools/prepare_volterra_data.py</code>, then reload the page.</p>}
    </div>
  );
}

function Stat({ label, value, note }) {
  return (
    <div className="vm5-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

function TrendChart({ data, selected, through }) {
  const rows = (data?.states || [])
    .filter((row) => row.state === selected && row.month <= through)
    .sort((a, b) => a.month.localeCompare(b.month));

  const width = 560;
  const height = 218;
  const left = 48;
  const right = width - 23;
  const top = 22;
  const bottom = height - 39;
  const ceiling = Math.max(10, ...rows.map((row) => Math.max(row.ev, row.hybrid))) * 1.12;
  const x = (index) => left + ((right - left) * index / Math.max(1, rows.length - 1));
  const y = (value) => bottom - ((bottom - top) * value / ceiling);
  const path = (key) => rows.map((row, index) =>
    `${index ? 'L' : 'M'}${x(index).toFixed(1)} ${y(row[key]).toFixed(1)}`
  ).join(' ');
  const tickIndexes = [...new Set(
    rows.length <= 6
      ? rows.map((_, index) => index)
      : [0, .25, .5, .75, 1].map((p) => Math.round(p * (rows.length - 1)))
  )];
  const formatTick = (value) => new Date(`${value}-01T00:00:00`).toLocaleDateString('en-GB', {
    month: 'short',
    year: '2-digit'
  });

  return (
    <div className="vm5-trend">
      <div className="vm5-chart-title">
        <span>MONTHLY REGISTRATION TREND</span>
        <div className="vm5-key"><i /> EV <i /> Hybrid</div>
      </div>
      <p className="vm5-chart-subtitle">
        Compare monthly EV and hybrid transactions specifically recorded against {selected}.
      </p>
      {rows.length === 0 ? (
        <p className="vm5-muted">No monthly observations are available for this selection.</p>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`${selected} monthly EV and hybrid transaction counts`}
        >
          {[0, .5, 1].map((level) => (
            <g key={level}>
              <line
                x1={left} x2={right}
                y1={y(ceiling * level)} y2={y(ceiling * level)}
                stroke="currentColor" opacity=".12" strokeDasharray="3 5"
              />
              <text
                x={left - 9} y={y(ceiling * level) + 4}
                textAnchor="end" fill="currentColor" fontSize="11"
                fontFamily="Inter, sans-serif" fontWeight="500" opacity=".6"
              >
                {fmt(ceiling * level)}
              </text>
            </g>
          ))}
          <path d={path('hybrid')} fill="none" stroke="#89918C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d={path('ev')} fill="none" stroke={ACCENT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {tickIndexes.map((index) => (
            <text
              key={rows[index].month}
              x={x(index)} y={height - 11}
              textAnchor={index === 0 ? 'start' : index === rows.length - 1 ? 'end' : 'middle'}
              fill="currentColor" fontSize="11" fontFamily="Inter, sans-serif"
              fontWeight="500" opacity=".7"
            >
              {formatTick(rows[index].month)}
            </text>
          ))}
        </svg>
      )}
      <p className="vm5-muted vm5-trend-caveat">
        Known-state registrations only; these do not represent all vehicles used or owned in {selected}.
      </p>
    </div>
  );
}

function Ranking({ rows, selected, onSelect, metric }) {
  const best = rows.filter((r) => Number.isFinite(byNumber(r, metric)))
    .sort((a, b) => byNumber(b, metric) - byNumber(a, metric)).slice(0, 10);
  const max = Math.max(1, ...best.map((r) => byNumber(r, metric)));
  return (
    <div className="vm5-rank-list">
      {best.map((row, i) => (
        <button key={row.state} type="button"
          className={`vm5-rank-row ${selected === row.state ? 'selected' : ''}`}
          onClick={() => onSelect(row.state)}>
          <span className="vm5-rank-no">{String(i + 1).padStart(2, '0')}</span>
          <span className="vm5-rank-info">
            <span>{row.state}</span>
            <span className="vm5-rank-track"><span style={{ width: `${(100 * byNumber(row, metric) / max)}%` }} /></span>
          </span>
          <strong>{metric.includes('share') ? percent(byNumber(row, metric)) : fmt(byNumber(row, metric))}</strong>
        </button>
      ))}
    </div>
  );
}

export function GeographicIntelligencePage() {
  const { data, error } = useJPJData();
  const [month, setMonth] = useState('2026-08');
  const [period, setPeriod] = useState('ytd');
  const [metric, setMetric] = useState('ev');
  const [selected, setSelected] = useState('Johor');
  const months = data?.meta?.months || [];
  const chosenMonth = months.includes(month) ? month : months[months.length - 1];
  const rows = useMemo(() => rowsByState(filterRows(data, chosenMonth, period)), [data, chosenMonth, period]);
  const coverage = useMemo(() => {
    const list = (data?.coverage || []).filter((r) => period === 'month' ? r.month === chosenMonth : r.month <= chosenMonth);
    const allocated = list.reduce((n, r) => n + r.known_state, 0);
    const total = list.reduce((n, r) => n + r.all, 0);
    return { allocated, total, unallocated: total - allocated, coverage: total ? 100 * allocated / total : null };
  }, [data, chosenMonth, period]);
  const focus = rows.find((r) => r.state === selected);
  const metricMap = useMemo(() => Object.fromEntries(rows.map((r) => [r.state, byNumber(r, metric)])), [rows, metric]);

  if (!data) return <StatusView error={error} />;

  return (
    <div className="page inner-page vm5-geographic">
      <div className="vm5-page-head">
        <div>
          <div className="vm5-eyebrow"><span className="vm5-accent-dot" /> 02 / GEOSPATIAL INTELLIGENCE</div>
          <h1>Malaysia, by registration.</h1>
          <p>An interactive geographic view of the registrations that JPJ reports with an identifiable state.</p>
        </div>
        <div className="vm5-report-tag">OFFICIAL JPJ DATA · 2026</div>
      </div>
      <div className="vm5-toolbar">
        <label>PERIOD <select value={chosenMonth} onChange={(e) => setMonth(e.target.value)}>{months.map((m) => <option key={m} value={m}>{prettyMonth(m)}</option>)}</select></label>
        <div className="vm5-segments" aria-label="Data aggregation">
          <button className={period === 'ytd' ? 'selected' : ''} onClick={() => setPeriod('ytd')}>Year to date</button>
          <button className={period === 'month' ? 'selected' : ''} onClick={() => setPeriod('month')}>Selected month</button>
        </div>
        <label className="vm5-metric-filter">MAP LAYER <select value={metric} onChange={(e) => setMetric(e.target.value)}>{metricOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
      </div>
      <div className="vm5-summary">
        <Stat label="KNOWN-STATE REGISTRATIONS" value={fmt(coverage.allocated)} note="Records included on map" />
        <Stat label="UNALLOCATED REGISTRATIONS" value={fmt(coverage.unallocated)} note="Rakan Niaga / unassigned" />
        <Stat label="STATE ASSIGNMENT COVERAGE" value={percent(coverage.coverage, 2)} note="Of all JPJ transactions in period" />
        <Stat label="MAPPING WINDOW" value={period === 'month' ? prettyMonth(chosenMonth) : `JAN–${prettyMonth(chosenMonth).split(' ')[0].toUpperCase()} 2026`} note="Registration date, 2026" />
      </div>
      <div className="vm5-coverage-warning">
        <strong>Data coverage matters.</strong> Only {percent(coverage.coverage, 2)} of transactions in this period carry a recognized state. Grey shading compares <b>known-state registrations only</b>; it does not estimate where the unallocated records belong or represent the actual EV ownership rate of residents.
      </div>
      <div className="vm5-map-layout">
        <div className="vm5-map-pane">
          <div className="vm5-pane-heading"><div><span className="vm5-eyebrow">STATE INTELLIGENCE</span><h2>Interactive registration atlas<span className="vm5-lime">.</span></h2></div><span className="vm5-muted">Select a state · zoom to explore</span></div>
          <StateChoroplethMap selected={selected} onSelect={setSelected} metricValues={metricMap} />
          <div className="vm5-map-legend"><span>LOWER</span><i /><i /><i /><i /><i /><span>HIGHER</span><span className="vm5-legend-selected"><em /> SELECTED STATE</span></div>
        </div>
        <aside className="vm5-side-pane">
          <span className="vm5-eyebrow">LOCATION / SELECTED STATE</span>
          <h2>{selected}</h2>
          <p>Records explicitly registered in this state. JPJ registration location does not necessarily reflect the vehicle’s current location.</p>
          <div className="vm5-side-stats">
            <Stat label="TOTAL REGISTRATIONS" value={fmt(focus?.total)} />
            <Stat label="ELECTRIC" value={fmt(focus?.ev)} note={focus ? percent(focus.ev_share) + ' of known-state registrations' : 'No records'} />
            <Stat label="HYBRID" value={fmt(focus?.hybrid)} />
            <Stat label="ELECTRIFICATION" value={percent(focus?.electrification_share)} />
          </div>
          <TrendChart data={data} selected={selected} through={chosenMonth} />
        </aside>
      </div>
      <div className="vm5-lower-grid">
        <div className="vm5-panel"><div className="vm5-pane-heading"><div><span className="vm5-eyebrow">REGIONAL COMPARISON</span><h2>State ranking<span className="vm5-lime">.</span></h2></div><span className="vm5-muted">{metricOptions.find((m) => m.value === metric)?.label}</span></div><Ranking rows={rows} selected={selected} onSelect={setSelected} metric={metric} /></div>
        <MyEVDataCoverage coverage={coverage} month={chosenMonth} period={period} />
      </div>
    </div>
  );
}

function BrandBars({ items, label = 'registrations' }) {
  const max = Math.max(1, ...items.map((r) => r.value));
  return (
    <div className="vm5-brand-bars">
      {items.map((item, index) => (
        <div className="vm5-brand-row" key={item.name}>
          <span className="vm5-brand-rank">{String(index + 1).padStart(2, '0')}</span>
          <div className="vm5-brand-name"><span>{item.name}</span><span className="vm5-rank-track"><span style={{ width: `${item.value / max * 100}%` }} /></span></div>
          <b>{fmt(item.value)}</b>
        </div>
      ))}
      <span className="vm5-muted">Counts represent {label} in the selected 2026 JPJ transaction dataset.</span>
    </div>
  );
}

export function MarketBrandInsights() {
  const { data, error } = useJPJData();
  const [fuel, setFuel] = useState('ev');
  const [scope, setScope] = useState('all');
  const [month, setMonth] = useState('2026-08');
  const months = data?.meta?.months || [];
  const selectedMonth = months.includes(month) ? month : months[months.length - 1];

  const source = useMemo(() => (data?.brands || []).filter((row) =>
    row.month <= selectedMonth && (scope === 'all' || row.state === scope)
  ), [data, selectedMonth, scope]);

  const brandTotals = useMemo(() => {
    const totals = new Map();
    source.forEach((row) => {
      totals.set(row.brand, (totals.get(row.brand) || 0) + (row[fuel] || 0));
    });
    return [...totals].map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [source, fuel]);

  const topBrands = brandTotals.slice(0, 10);
  const models = useMemo(() => {
    const totals = new Map();
    (data?.models || [])
      .filter((row) => row.month <= selectedMonth && (scope === 'all' || row.state === scope))
      .forEach((row) => {
        const key = `${row.brand} ${row.model}`;
        totals.set(key, (totals.get(key) || 0) + (row[fuel] || 0));
      });
    return [...totals].map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 8);
  }, [data, selectedMonth, scope, fuel]);

  if (!data) {
    return <section className="vm5-market-append"><StatusView error={error} /></section>;
  }

  const states = [...new Set(data.states.map((row) => row.state))].sort();
  const totalFuel = brandTotals.reduce((sum, row) => sum + row.value, 0);
  const leadingBrand = topBrands[0];
  const leadingModel = models[0];
  const leadingShare = totalFuel > 0 && leadingBrand
    ? 100 * leadingBrand.value / totalFuel
    : null;
  const fuelLabel = fuel === 'ev' ? 'electric' : fuel === 'hybrid' ? 'hybrid' : 'petrol';
  const sourceScope = scope === 'all'
    ? 'Across all recorded registration channels, including Rakan Niaga.'
    : `Only transactions explicitly assigned to ${scope}; unallocated records are excluded.`;

  return (
    <section className="vm5-market-append" aria-label="2026 brand and model market intelligence">
      <div className="vm5-page-head">
        <div>
          <span className="vm5-eyebrow">2026 / BRAND & MODEL INTELLIGENCE</span>
          <h2>Who's shaping the transition<span className="vm5-lime">.</span></h2>
          <p>
            Identify the brands and car models contributing most to new {fuelLabel} registrations.
            Change the channel, fuel type or reporting month to explore how the ranking changes.
          </p>
        </div>
        <span className="vm5-report-tag">JPJ 2026 TRANSACTION DATA</span>
      </div>

      <div className="vm5-toolbar">
        <label>
          THROUGH
          <select value={selectedMonth} onChange={(event) => setMonth(event.target.value)}>
            {months.map((value) => <option key={value} value={value}>{prettyMonth(value)}</option>)}
          </select>
        </label>
        <label>
          REGISTRATION CHANNEL
          <select value={scope} onChange={(event) => setScope(event.target.value)}>
            <option value="all">All channels (nationwide)</option>
            {states.map((state) => (
              <option key={state} value={state}>{state} (known-state)</option>
            ))}
          </select>
        </label>
        <div className="vm5-segments" role="group" aria-label="Select vehicle fuel">
          {['ev', 'hybrid', 'petrol'].map((item) => (
            <button
              key={item}
              type="button"
              className={fuel === item ? 'selected' : ''}
              onClick={() => setFuel(item)}
            >
              {item === 'ev' ? 'EV' : item === 'hybrid' ? 'Hybrid' : 'Petrol'}
            </button>
          ))}
        </div>
      </div>

      <div className="vm5-summary vm5-summary-compact">
        <Stat
          label="SELECTED FUEL REGISTRATIONS"
          value={fmt(totalFuel)}
          note={`January–${prettyMonth(selectedMonth)} · ${scope === 'all' ? 'all channels' : scope}`}
        />
        <Stat
          label="LEADING BRAND"
          value={leadingBrand?.name || '—'}
          note={leadingBrand ? `${fmt(leadingBrand.value)} registrations` : 'No observations'}
        />
        <Stat
          label="LEADING MODEL"
          value={leadingModel?.name || '—'}
          note={leadingModel ? `${fmt(leadingModel.value)} registrations` : 'No observations'}
        />
        <Stat
          label="TOP BRAND SHARE"
          value={percent(leadingShare)}
          note="Share of all selected-fuel registrations"
        />
      </div>

      <div className="vm5-reading-note">
        <span className="vm5-reading-icon" aria-hidden="true">i</span>
        <div>
          <strong>How to read these rankings</strong>
          <p>
            Bars show cumulative 2026 registrations up to the selected month, not vehicle sales or cars currently on the road.
            {' '}{sourceScope}
          </p>
        </div>
      </div>

      <div className="vm5-lower-grid">
        <div className="vm5-panel">
          <div className="vm5-pane-heading">
            <div>
              <span className="vm5-eyebrow">BRAND PERFORMANCE</span>
              <h2>Top manufacturers<span className="vm5-lime">.</span></h2>
              <p className="vm5-panel-note">Which manufacturers contribute the most registrations in the selected category?</p>
            </div>
            <span className="vm5-muted">Jan–{prettyMonth(selectedMonth)} · {fuel.toUpperCase()}</span>
          </div>
          <BrandBars items={topBrands} label={`${fuelLabel} car registrations`} />
        </div>
        <div className="vm5-panel">
          <div className="vm5-pane-heading">
            <div>
              <span className="vm5-eyebrow">PRODUCT PERFORMANCE</span>
              <h2>Most registered models<span className="vm5-lime">.</span></h2>
              <p className="vm5-panel-note">See the specific vehicle models behind each fuel-category ranking.</p>
            </div>
            <span className="vm5-muted">Ranked by registration count</span>
          </div>
          <BrandBars items={models} label={`${fuelLabel} car registrations`} />
        </div>
      </div>

      <div className="vm5-coverage-warning">
        <strong>Data source & coverage:</strong> The 2026 transaction dataset and historical nationwide monthly totals are
        separate official inputs with some differences in counts. Do not add these rankings to the Overview figures.
        When a state is selected, only records explicitly attributed to that state are included.
      </div>
    </section>
  );
}
