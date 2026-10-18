import React, { useEffect, useMemo, useRef, useState } from 'react';
import policyHistory from '../data/policy_history.json';
import './PolicyIntelligence.css';

/**
 * MyEV — policy exploration backed by existing JPJ monthly aggregates.
 * The descriptive event windows are NOT estimates of causal policy effects.
 * Nothing in this file changes the academic ITS / reduced regression models.
 */
const LIME = '#A9FF19';
const DATA = [...(policyHistory?.monthly ?? [])]
  .filter((row) => /^\d{4}-\d{2}$/.test(row.date))
  .sort((a, b) => a.date.localeCompare(b.date));

const BY_MONTH = new Map(DATA.map((row) => [row.date, row]));
const HISTORY = DATA.filter((row) => row.date >= '2011-01');
const MIN_MONTH = DATA[0]?.date;
const MAX_MONTH = DATA[DATA.length - 1]?.date;

const EVENTS = [
  {
    id: 'nap2014',
    month: '2014-01',
    displayDate: 'JAN 2014',
    shortLabel: 'NAP 2014',
    name: 'NAP 2014: CBU hybrid incentives end',
    type: 'HYBRID / POLICY',
    scope: 'CBU hybrid vehicles',
    mechanism: 'End of the earlier CBU hybrid incentive period',
    description: 'The notebook annotates January 2014 in the hybrid market-share series and uses December 2013 as the last exemption month in Figure 5.',
    interpretation: 'The timing helps examine shifts in hybrid registrations. It does not isolate the effect of the policy.',
    timing: 'Notebook Figure 3 annotation: Jan 2014; Figure 5 index base: Dec 2013',
    source: 'Notebook source notes: paultan.org (2014); Hamzah et al. (2021)'
  },
  {
    id: 'gst2018',
    month: '2018-06',
    displayDate: 'JUN–AUG 2018',
    shortLabel: 'GST holiday',
    name: 'GST tax holiday',
    type: 'TAX WINDOW',
    scope: 'Passenger-car market',
    mechanism: 'GST zero-rating before SST returned in September',
    description: 'The June–August 2018 GST zero-rating window is shown as a market context event. The event marker is anchored at June, as in the Colab policy timeline.',
    interpretation: 'The before/after window overlaps the temporary GST period, so it should be read as descriptive context.',
    timing: 'Notebook Figure 3 marker: Jun 2018; window Jun–Aug 2018',
    source: 'Notebook source notes: The Malaysian Reserve (2018)'
  },
  {
    id: 'mco2020',
    month: '2020-04',
    displayDate: 'APR 2020',
    shortLabel: 'MCO',
    name: 'MCO lockdown',
    type: 'MACRO SHOCK',
    scope: 'National mobility and vehicle registrations',
    mechanism: 'Pandemic-related movement and economic restrictions',
    description: 'Figure 3 marks April 2020. The Movement Control Order started in March 2020; April is the monthly analysis reference used in the notebook.',
    interpretation: 'Registration changes reflect a broad economic shock and cannot be attributed to any single measure.',
    timing: 'Notebook Figure 3 marker: Apr 2020; MCO began in Mar 2020',
    source: 'Notebook source notes: Tang (2022), Journal of Public Health'
  },
  {
    id: 'budget2022',
    month: '2022-01',
    displayDate: 'JAN 2022',
    shortLabel: 'Budget 2022',
    name: 'Budget 2022 EV tax exemption',
    type: 'EV INCENTIVE',
    scope: 'Electric vehicles',
    mechanism: 'EV-related import, excise and sales tax exemptions',
    description: 'The notebook uses January 2022 as an important EV adoption reference month and as the start of the regression training window.',
    interpretation: 'The subsequent EV growth overlaps changes in market supply, prices and consumer demand.',
    timing: 'Notebook Figure 3 annotation: Jan 2022',
    source: 'Notebook source notes: Ministry of Finance (2021); Umair et al. (2024)'
  },
  {
    id: 'cbu2025',
    month: '2025-12',
    displayDate: 'DEC 2025',
    shortLabel: 'CBU EV ends',
    name: 'CBU EV exemption ends',
    type: 'EV / TAX',
    scope: 'Completely built-up electric vehicles',
    mechanism: 'CBU EV import/excise duty exemption boundary',
    description: 'December 2025 is the base month for the EV series in Notebook Figure 5, which compares two historical CBU exemption endings.',
    interpretation: 'The post-event period in the dataset ends August 2026 and is shorter than a complete 12-month window.',
    timing: 'Notebook Figure 3 annotation: Dec 2025; Figure 5 EV index base: Dec 2025',
    source: 'Notebook source notes: Tan et al. (2025)'
  },
  {
    id: 'roadtax2026',
    month: '2026-01',
    displayDate: 'JAN 2026',
    shortLabel: 'EV road tax',
    name: 'EV road tax begins',
    type: 'EV / TAX',
    scope: 'EV road taxation',
    mechanism: 'End of EV road-tax exemption and new power-based assessment',
    description: 'The original notebook labels the January 2026 change as the beginning of EV road tax, not simply a generic post-exemption regime.',
    interpretation: 'This event is only one month after the December 2025 CBU boundary; their separate statistical effects cannot be inferred from a simple trend chart.',
    timing: 'Notebook Figure 3 annotation: Jan 2026',
    source: 'Notebook source notes: Tan et al. (2025)'
  }
];

const METRICS = [
  { key: 'ev', label: 'EV registrations', unit: 'vehicles', about: 'Monthly number of newly registered electric passenger cars.' },
  { key: 'evShare', label: 'EV market share', unit: '% of all cars', about: 'EV registrations divided by all passenger-car registrations.' },
  { key: 'evOfElectrified', label: 'EV within electrified', unit: '% of EV + hybrid', about: 'EV registrations divided by the combined EV and hybrid total.' },
  { key: 'hybrid', label: 'Hybrid registrations', unit: 'vehicles', about: 'Monthly number of newly registered hybrid passenger cars.' },
  { key: 'total', label: 'All passenger cars', unit: 'vehicles', about: 'Total monthly passenger-car registrations; useful for broader disruptions such as the 2020 MCO.' }
];

const formatNumber = (value, digits = 0) =>
  Number.isFinite(value)
    ? value.toLocaleString('en-MY', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : '—';

function monthOffset(date, step) {
  const [year, month] = date.split('-').map(Number);
  const index = year * 12 + (month - 1) + step;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

function prettyMonth(date, options = { month: 'short', year: 'numeric' }) {
  if (!date) return '—';
  return new Date(`${date}-01T12:00:00Z`).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' });
}

const mean = (values) => values.length
  ? values.reduce((sum, item) => sum + item, 0) / values.length
  : null;

function readWindow(event, metric) {
  const months = Array.from({ length: 13 }, (_, index) => {
    const offset = index - 6;
    const date = monthOffset(event.month, offset);
    const raw = BY_MONTH.get(date);
    const numericValue = raw?.[metric];
    return {
      date,
      offset,
      value: typeof numericValue === 'number' && Number.isFinite(numericValue) ? numericValue : null
    };
  });

  const before = months.filter((row) => row.offset < 0 && row.value !== null);
  const after = months.filter((row) => row.offset > 0 && row.value !== null);
  const beforeAvg = mean(before.map((row) => row.value));
  const afterAvg = mean(after.map((row) => row.value));
  // Only call the comparison complete when six months exist on both sides.
  const comparable = before.length === 6 && after.length === 6;
  const diff = comparable ? afterAvg - beforeAvg : null;
  const isShare = metric === 'evShare' || metric === 'evOfElectrified';
  const relativeChange = comparable && !isShare && beforeAvg > 0
    ? (100 * diff) / beforeAvg
    : null;
  let direction = 'Insufficient matched data';
  if (comparable) {
    if (isShare) {
      direction = Math.abs(diff) < 0.8
        ? 'Limited net change'
        : diff > 0 ? 'Observed increase' : 'Observed decrease';
    } else {
      direction = Math.abs(relativeChange) < 5
        ? 'Limited net change'
        : relativeChange > 0 ? 'Observed increase' : 'Observed decrease';
    }
  }
  return { months, before, after, beforeAvg, afterAvg, diff, comparable, direction, relativeChange, isShare };
}

function MetricDisplay({ value, metric, sign = false, digits = null }) {
  if (!Number.isFinite(value)) return '—';
  const isShare = metric === 'evShare' || metric === 'evOfElectrified';
  const shown = formatNumber(value, digits ?? (isShare ? 2 : 0));
  return `${sign && value > 0 ? '+' : ''}${shown}${isShare ? '%' : ''}`;
}

function SummaryTile({ label, value, description, accent = false }) {
  return (
    <div className={`vp-summary-tile ${accent ? 'vp-summary-tile--accent' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{description}</small>
    </div>
  );
}

function WindowTrendChart({ rows, metric, showAverage, event }) {
  const host = useRef(null);
  const [width, setWidth] = useState(820);
  const [hoverDate, setHoverDate] = useState(null);

  useEffect(() => {
    if (!host.current) return undefined;
    const node = host.current;
    const update = () => setWidth(Math.max(320, Math.round(node.clientWidth)));
    update();
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(update)
      : null;
    observer?.observe(node);
    return () => observer?.disconnect();
  }, []);

  const height = 278;
  const pad = { left: 54, right: 20, top: 26, bottom: 50 };
  const usableWidth = width - pad.left - pad.right;
  const usableHeight = height - pad.top - pad.bottom;
  const observed = rows.filter((row) => row.value !== null);
  const maxValue = Math.max(1, ...observed.map((row) => row.value));
  const maxY = (metric === 'evShare' || metric === 'evOfElectrified')
    ? Math.min(100, Math.ceil(maxValue / 10) * 10 + 10)
    : Math.ceil((maxValue * 1.16) / 500) * 500;
  const x = (offset) => pad.left + ((offset + 6) / 12) * usableWidth;
  const y = (value) => pad.top + usableHeight - (value / Math.max(1, maxY)) * usableHeight;

  const plotPath = (list) => list.map((row, index) =>
    `${index ? 'L' : 'M'} ${x(row.offset).toFixed(2)} ${y(row.value).toFixed(2)}`
  ).join(' ');

  // Missing months split paths rather than connecting across unavailable periods.
  function groupedSeries(list) {
    const parts = [];
    let segment = [];
    list.forEach((row) => {
      if (row.value === null) {
        if (segment.length > 1) parts.push(segment);
        segment = [];
      } else {
        segment.push(row);
      }
    });
    if (segment.length > 1) parts.push(segment);
    return parts;
  }

  const rolling = rows.map((row, i) => {
    const lookback = rows.slice(Math.max(0, i - 2), i + 1);
    return {
      ...row,
      value: lookback.length === 3 && lookback.every((item) => item.value !== null)
        ? mean(lookback.map((item) => item.value))
        : null
    };
  });
  const hovered = rows.find((row) => row.date === hoverDate);
  const formatAxis = (value) => metric === 'ev' || metric === 'hybrid'
    ? value >= 1000 ? `${formatNumber(value / 1000, 1)}k` : formatNumber(value)
    : `${formatNumber(value, 0)}%`;
  const formatValue = (value) => (metric === 'evShare' || metric === 'evOfElectrified')
    ? `${formatNumber(value, 2)}%` : formatNumber(value);

  return (
    <div className="vp-chart-stage" ref={host}>
      {hovered && hovered.value !== null && (
        <div className="vp-chart-readout" aria-live="polite">
          <b>{prettyMonth(hovered.date)}</b>
          <span>{formatValue(hovered.value)}</span>
        </div>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Real JPJ ${METRICS.find((m) => m.key === metric)?.label} from six months before to six months after ${event.name}. Missing months are not plotted.`}
      >
        <rect x={x(-6)} y={pad.top} width={x(0) - x(-6)} height={usableHeight} fill="currentColor" opacity="0.018" />
        <rect x={x(0)} y={pad.top} width={x(6) - x(0)} height={usableHeight} fill={LIME} opacity="0.065" />
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <g key={fraction}>
            <line
              x1={pad.left} x2={width - pad.right}
              y1={y(maxY * fraction)} y2={y(maxY * fraction)}
              stroke="currentColor" opacity="0.13" strokeDasharray="3 5"
            />
            <text x={pad.left - 12} y={y(maxY * fraction) + 4} textAnchor="end" className="vp-svg-axis">
              {formatAxis(maxY * fraction)}
            </text>
          </g>
        ))}
        <line
          x1={x(0)} x2={x(0)} y1={pad.top - 5} y2={pad.top + usableHeight}
          stroke="currentColor" opacity="0.65" strokeDasharray="5 5" strokeWidth="1.4"
        />
        <text x={Math.min(width - 75, x(0) + 9)} y={pad.top - 8} className="vp-svg-event-label">
          EVENT MONTH
        </text>
        {groupedSeries(rows).map((part, index) => (
          <path
            key={`observed-${index}`} d={plotPath(part)}
            fill="none" stroke="currentColor" strokeWidth="2.7"
            strokeLinecap="round" strokeLinejoin="round"
          />
        ))}
        {showAverage && groupedSeries(rolling).map((part, index) => (
          <path
            key={`rolling-${index}`} d={plotPath(part)}
            fill="none" stroke={LIME} strokeWidth="3.2"
            strokeLinecap="round" strokeLinejoin="round"
          />
        ))}
        {rows.filter((row) => row.value !== null).map((row) => (
          <g key={row.date}>
            <circle
              cx={x(row.offset)} cy={y(row.value)} r={hoverDate === row.date ? 6 : 4}
              fill={row.offset === 0 ? LIME : 'var(--vp-card)'}
              stroke="currentColor" strokeWidth="1.8" className="vp-point"
              onMouseEnter={() => setHoverDate(row.date)}
              onMouseLeave={() => setHoverDate(null)}
              onFocus={() => setHoverDate(row.date)}
              onBlur={() => setHoverDate(null)}
              tabIndex={0}
              role="img"
              aria-label={`${prettyMonth(row.date)}: ${formatValue(row.value)}`}
            />
          </g>
        ))}
        {[-6, -3, 0, 3, 6].map((offset) => (
          <text
            key={offset} x={x(offset)} y={height - 17}
            textAnchor="middle" className="vp-svg-axis"
          >
            {offset === 0 ? prettyMonth(event.month, { month: 'short', year: '2-digit' }) : `${offset > 0 ? '+' : ''}${offset}m`}
          </text>
        ))}
        <text x={pad.left} y={height - 2} className="vp-svg-side">PRE-EVENT</text>
        <text x={width - pad.right} y={height - 2} textAnchor="end" className="vp-svg-side">POST-EVENT</text>
      </svg>
    </div>
  );
}

function FullHistoryChart({ metric, selectedId, onSelect, notebookShares = true }) {
  const host = useRef(null);
  const [width, setWidth] = useState(1100);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return undefined;
    const update = () => setWidth(Math.max(320, Math.round(element.clientWidth)));
    update();
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(update)
      : null;
    observer?.observe(element);
    return () => observer?.disconnect();
  }, []);

  const height = 346;
  const margin = { left: 57, right: 22, top: 84, bottom: 42 };
  const usableWidth = Math.max(1, width - margin.left - margin.right);
  const usableHeight = height - margin.top - margin.bottom;
  const columns = notebookShares ? ['evShare', 'hybridShare'] : [metric];
  const validValues = HISTORY.flatMap((row) => columns.map((key) => row[key]).filter(Number.isFinite));
  const max = Math.max(1, ...validValues) * 1.12;
  const x = (index) => margin.left + (index / Math.max(1, HISTORY.length - 1)) * usableWidth;
  const y = (value) => margin.top + usableHeight - (value / max) * usableHeight;
  const getSegments = (key) => {
    const segments = [];
    let segment = [];
    HISTORY.forEach((row, index) => {
      if (!Number.isFinite(row[key])) {
        if (segment.length > 1) segments.push(segment);
        segment = [];
      } else {
        segment.push({ index, value: row[key] });
      }
    });
    if (segment.length > 1) segments.push(segment);
    return segments;
  };
  const toPath = (items) => items.map((point, i) =>
    `${i ? 'L' : 'M'}${x(point.index).toFixed(1)},${y(point.value).toFixed(1)}`
  ).join(' ');
  const formatAxis = (value) => notebookShares || ['evShare', 'evOfElectrified', 'hybridShare'].includes(metric)
    ? `${formatNumber(value, 1)}%`
    : value >= 1000 ? `${formatNumber(value / 1000, 1)}k` : formatNumber(value);
  const plottedEvents = EVENTS.filter((event) => HISTORY.some((row) => row.date === event.month));
  const activeHover = hover ? HISTORY.find((row) => row.date === hover) : null;

  return (
    <div>
      <div className="vp-history-plot-key">
        {notebookShares ? (
          <>
            <span><i className="vp-key-ev" /> EV market share</span>
            <span><i className="vp-key-hybrid" /> Hybrid market share</span>
          </>
        ) : (
          <span><i className="vp-key-selected" /> {METRICS.find((entry) => entry.key === metric)?.label}</span>
        )}
        <span className="vp-key-note">{notebookShares
          ? "Both series show a percentage of all newly registered passenger cars, matching the original notebook figure and improving early-period visibility."
          : METRICS.find((item) => item.key === metric)?.about}</span>
      </div>
      <div ref={host} className="vp-history-graph">
        {activeHover && (
          <div className="vp-history-readout">
            <strong>{prettyMonth(activeHover.date)}</strong>
            {columns.map((key) => (
              <span key={key}>{key === 'evShare' ? 'EV' : key === 'hybridShare' ? 'Hybrid' : 'Value'}: {' '}
                {formatNumber(activeHover[key], notebookShares || key.toLowerCase().includes('share') ? 2 : 0)}
                {(notebookShares || key.toLowerCase().includes('share')) ? '%' : ''}
              </span>
            ))}
          </div>
        )}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Original notebook Figure 3: national EV and hybrid market shares, with six named policy markers."
        >
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <g key={tick}>
              <line x1={margin.left} x2={width - margin.right} y1={y(tick * max)} y2={y(tick * max)}
                stroke="currentColor" opacity=".13" strokeDasharray="4 5" />
              <text x={margin.left - 10} y={y(tick * max) + 4} className="vp-svg-axis" textAnchor="end">
                {formatAxis(tick * max)}
              </text>
            </g>
          ))}
          {columns.map((column) => getSegments(column).map((points, index) => (
            <path
              key={`${column}-${index}`}
              d={toPath(points)}
              fill="none"
              stroke={notebookShares && column === 'hybridShare' ? '#777F7C' : notebookShares ? LIME : 'currentColor'}
              strokeWidth={notebookShares ? 2.8 : 2.8}
              strokeLinecap="round" strokeLinejoin="round"
            />
          )))}
          {HISTORY.map((row, index) => (
            <rect key={row.date} x={x(index) - Math.max(1, usableWidth / HISTORY.length / 2)}
              y={margin.top} width={Math.max(3, usableWidth / HISTORY.length)} height={usableHeight}
              fill="transparent" onMouseEnter={() => setHover(row.date)} onMouseLeave={() => setHover(null)}
            />
          ))}
          {plottedEvents.map((event, i) => {
            const index = HISTORY.findIndex((row) => row.date === event.month);
            const active = event.id === selectedId;
            const xPos = x(index);
            const value = Number.isFinite(HISTORY[index][columns[0]]) ? HISTORY[index][columns[0]] : 0;
            const labelRow = i === 5 ? 1 : 0;
            // Last two events are one month apart. Put them in separate label rows.
            const labelX = Math.min(width - 83, Math.max(margin.left + 5, xPos - (i === 4 ? 115 : i === 5 ? 100 : 30)));
            return (
              <g key={event.id}>
                <line x1={xPos} x2={xPos} y1={margin.top - 5} y2={margin.top + usableHeight}
                  stroke={active ? LIME : '#9CA49D'} strokeWidth={active ? 2 : 1.1} strokeDasharray="4 5" />
                <circle
                  cx={xPos} cy={y(value)} r={active ? 7 : 5.6}
                  fill={active ? LIME : 'var(--vp-card)'} stroke="#171918" strokeWidth="2"
                  className="vp-history-marker" role="button" tabIndex={0}
                  aria-label={`${i + 1}: ${event.displayDate} — ${event.name}`}
                  onClick={() => onSelect(event.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(event.id);
                    }
                  }}
                >
                  <title>{`${event.displayDate} — ${event.name}`}</title>
                </circle>
                {width >= 850 && (
                  <g className="vp-plot-event-label" onClick={() => onSelect(event.id)}>
                    <text x={labelX} y={22 + labelRow * 29} className={active ? 'vp-plot-label-active' : 'vp-plot-label'}>
                      {String(i + 1).padStart(2, '0')} · {event.shortLabel}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          {HISTORY.filter((row) => row.date.endsWith('-01') && Number(row.date.slice(0, 4)) % 2 === 0).map((row) => (
            <text key={row.date} x={x(HISTORY.findIndex((item) => item.date === row.date))}
              y={height - 10} className="vp-svg-axis" textAnchor="middle">
              {row.date.slice(0, 4)}
            </text>
          ))}

        </svg>
      </div>
      <div className="vp-policy-event-legend" aria-label="Notebook policy markers explained">
        {plottedEvents.map((event, i) => (
          <button
            key={event.id}
            type="button"
            className={`vp-policy-legend-item ${event.id === selectedId ? 'is-active' : ''}`}
            onClick={() => onSelect(event.id)}
            aria-pressed={event.id === selectedId}
          >
            <span className="vp-policy-legend-no">{String(i + 1).padStart(2, '0')}</span>
            <span className="vp-policy-legend-text"><b>{event.name}</b><small>{event.displayDate}</small></span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TaxExemptionComparisonChart() {
  const host = useRef(null);
  const [width, setWidth] = useState(1000);
  useEffect(() => {
    const element = host.current;
    if (!element) return undefined;
    const update = () => setWidth(Math.max(320, Math.round(element.clientWidth)));
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(element);
    return () => observer?.disconnect();
  }, []);

  // Notebook Figure 5: index base is the FINAL exemption month (Dec 2013 / Dec 2025).
  function indexedWindow(metric, baseDate) {
    const base = BY_MONTH.get(baseDate)?.[metric];
    return Array.from({ length: 25 }, (_, position) => {
      const offset = position - 12;
      const record = BY_MONTH.get(monthOffset(baseDate, offset));
      const value = Number.isFinite(record?.[metric]) && base > 0
        ? (100 * record[metric] / base)
        : null;
      return { offset, value };
    });
  }
  const hybrid = indexedWindow('hybridShare', '2013-12');
  const ev = indexedWindow('evShare', '2025-12');
  const maxValue = Math.max(150, ...hybrid.concat(ev).map((row) => row.value).filter(Number.isFinite)) * 1.08;
  const height = 290;
  const pad = { top: 25, right: 25, bottom: 42, left: 54 };
  const innerW = Math.max(1, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const x = (offset) => pad.left + ((offset + 12) / 24) * innerW;
  const y = (value) => pad.top + innerH - (value / maxValue) * innerH;
  const segments = (items) => {
    const result = [];
    let part = [];
    items.forEach((item) => {
      if (item.value === null) {
        if (part.length > 1) result.push(part);
        part = [];
      } else {
        part.push(item);
      }
    });
    if (part.length > 1) result.push(part);
    return result;
  };
  const toPath = (part) => part.map((row, i) =>
    `${i ? 'L' : 'M'}${x(row.offset).toFixed(1)},${y(row.value).toFixed(1)}`
  ).join(' ');
  const plus6Hybrid = hybrid.find((row) => row.offset === 6)?.value;
  const plus6Ev = ev.find((row) => row.offset === 6)?.value;

  return (
    <section className="vp-card vp-notebook-figure5">
      <div className="vp-analysis-head">
        <div>
          <span className="vp-eyebrow">FROM YOUR COLAB / FIGURE 5</span>
          <h2>Two CBU exemption endings<span>.</span></h2>
          <p>Compare hybrid market share around December 2013 with EV market share around December 2025. Each series is indexed to 100 in its own last exemption month.</p>
        </div>
        <span className="vp-mini-badge">INDEX · MONTH 0 = 100</span>
      </div>
      <div className="vp-history-plot-key">
        <span><i className="vp-key-hybrid" /> Hybrid / Dec 2013</span>
        <span><i className="vp-key-ev" /> EV / Dec 2025</span>
      </div>
      <div className="vp-history-graph vp-tax-comparison" ref={host}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}
          preserveAspectRatio="xMidYMid meet" role="img"
          aria-label="Notebook Figure 5, hybrid and EV market share indices indexed to 100 at each exemption ending">
          {[0, 0.5, 1].map((frac) => (
            <g key={frac}>
              <line x1={pad.left} x2={width - pad.right} y1={y(maxValue * frac)} y2={y(maxValue * frac)}
                stroke="currentColor" opacity=".13" strokeDasharray="4 5" />
              <text x={pad.left - 10} y={y(maxValue * frac) + 4}
                className="vp-svg-axis" textAnchor="end">{formatNumber(maxValue * frac, 0)}</text>
            </g>
          ))}
          <line x1={x(0)} x2={x(0)} y1={pad.top} y2={pad.top + innerH}
            stroke="currentColor" opacity=".6" strokeDasharray="5 5" />
          <line x1={pad.left} x2={width - pad.right} y1={y(100)} y2={y(100)}
            stroke="currentColor" opacity=".45" strokeDasharray="3 5" />
          {[
            { key: 'hybrid', points: hybrid, color: '#777F7C' },
            { key: 'ev', points: ev, color: LIME }
          ].map((series) => segments(series.points).map((part, i) => (
            <path key={`${series.key}-${i}`} d={toPath(part)}
              fill="none" stroke={series.color} strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round" />
          )))}
          {[-12, -6, 0, 6, 12].map((tick) => (
            <text key={tick} x={x(tick)} y={height - 14} textAnchor="middle" className="vp-svg-axis">
              {tick === 0 ? '0 · ending' : `${tick > 0 ? '+' : ''}${tick} months`}
            </text>
          ))}
        </svg>
      </div>
      <div className="vp-tax-interpretation">
        <div><small>HYBRID / +6 MONTHS</small><strong>{Number.isFinite(plus6Hybrid) ? `${formatNumber(plus6Hybrid, 1)} index` : '—'}</strong></div>
        <div><small>EV / +6 MONTHS</small><strong>{Number.isFinite(plus6Ev) ? `${formatNumber(plus6Ev, 1)} index` : '—'}</strong></div>
        <p>The green EV series has only eight observed post-event months through August 2026; missing months are intentionally not drawn. An indexed share comparison is descriptive—not a forecast or evidence that one policy caused a change.</p>
      </div>
    </section>
  );
}

function NotebookMethodResults() {
  return (
    <section className="vp-card vp-notebook-methods">
      <div className="vp-analysis-head">
        <div>
          <span className="vp-eyebrow">FROM YOUR COLAB / FIGURE 14 & STATISTICAL TESTS</span>
          <h2>How the notebook tests the pattern<span>.</span></h2>
          <p>These are saved notebook outputs, not statistical tests recalculated by the browser.</p>
        </div>
      </div>
      <div className="vp-methods-grid">
        <div className="vp-method-card">
          <span className="vp-eyebrow">STRUCTURAL BREAKS / FIGURE 14</span>
          <h3>Regime shifts</h3>
          <p>The notebook examines EV and Hybrid market shares and their level changes. Its supplied saved output reports a <b>penalised-SSE offline fallback</b>. To report PELT-specific results, rerun Colab with <code>ruptures</code> installed.</p>
        </div>
        <div className="vp-method-card">
          <span className="vp-eyebrow">CHOW TEST / SAVED OUTPUT</span>
          <h3>Breakpoint checks</h3>
          <div className="vp-chow-table" role="table" aria-label="Saved notebook Chow tests">
            <div role="row"><span>Hybrid share · Jan 2014</span><b>F 64.19</b><small>p &lt; 0.0001</small></div>
            <div role="row"><span>EV share · Feb 2026</span><b>F 12.55</b><small>p &lt; 0.0001</small></div>
            <div role="row"><span>Hybrid share · Feb 2026</span><b>F 47.22</b><small>p &lt; 0.0001</small></div>
            <div role="row"><span>logit(EV / EV+Hybrid) · Feb 2026</span><b>F 11.74</b><small>p = 0.0001</small></div>
          </div>
        </div>
        <div className="vp-method-card">
          <span className="vp-eyebrow">INTERRUPTED TIME SERIES / M5</span>
          <h3>Full vs reduced regression</h3>
          <div className="vp-m5-values"><div><small>FULL · ADJ. R²</small><strong>0.8287</strong></div><div><small>REDUCED · ADJ. R²</small><strong>0.8336</strong></div></div>
          <p>The saved HAC refit removed <b>RUSH</b> and <b>POST_T</b>, retaining Trend and POST. Coefficients are on the logit scale; these findings are not direct causal effects.</p>
        </div>
      </div>
    </section>
  );
}

export default function PolicyIntelligence({ go }) {
  const [eventId, setEventId] = useState('cbu2025');
  const [metric, setMetric] = useState('evShare');
  const [showAverage, setShowAverage] = useState(true);
  const detailsRef = useRef(null);
  const selected = EVENTS.find((event) => event.id === eventId) ?? EVENTS[4];
  const currentMetric = METRICS.find((item) => item.key === metric) ?? METRICS[0];
  const result = useMemo(() => readWindow(selected, metric), [selected, metric]);

  const deltaText = result.comparable
    ? result.isShare
      ? `${result.diff > 0 ? '+' : ''}${formatNumber(result.diff, 2)} pp`
      : Number.isFinite(result.relativeChange)
        ? `${result.relativeChange > 0 ? '+' : ''}${formatNumber(result.relativeChange, 1)}%`
        : `${result.diff > 0 ? '+' : ''}${formatNumber(result.diff, 0)} vehicles`
    : '—';

  const earliest = MIN_MONTH ? prettyMonth(MIN_MONTH) : 'unavailable';
  const latest = MAX_MONTH ? prettyMonth(MAX_MONTH) : 'unavailable';

  function pickEvent(event) {
    setEventId(event.id);
  }

  return (
    <div className="page inner-page vp-policy-page">
      <div className="vp-intro">
        <div>
          <span className="vp-eyebrow"><i className="vp-signal-dot" /> 04 / POLICY INTELLIGENCE</span>
          <h1>Explore the change around the event<span>.</span></h1>
          <p>Explore the original Colab policy timeline, compare EV and Hybrid market shares, and inspect the two CBU tax-exemption endings alongside statistical tests.</p>
        </div>
        <span className="vp-source-tag">JPJ OPEN DATA · {latest.toUpperCase()}</span>
      </div>

      <div className="vp-quick-guide" role="note">
        <div><b>01</b><span>Choose a policy or research event</span></div>
        <div><b>02</b><span>Check the trend and six-month averages</span></div>
        <div><b>03</b><span>Read the data limits before drawing conclusions</span></div>
      </div>

      <div className="vp-top-layout">
        <section className="vp-card vp-archive">
          <div className="vp-card-heading">
            <span className="vp-eyebrow">POLICY EVENTS / ORIGINAL NOTEBOOK</span>
            <h2>The events in your study<span>.</span></h2>
            <p>Each event changes the chart below. Select an event to explore the observed national trend near that date.</p>
          </div>
          <div className="vp-event-list">
            {EVENTS.map((event, i) => (
              <button
                key={event.id}
                type="button"
                className={`vp-event-option ${eventId === event.id ? 'is-active' : ''}`}
                onClick={() => pickEvent(event)}
                aria-pressed={eventId === event.id}
              >
                <span className="vp-event-index">{String(i + 1).padStart(2, '0')}</span>
                <span className="vp-event-copy">
                  <small>{event.displayDate}</small>
                  <strong>{event.name}</strong>
                </span>
                <span className="vp-event-type">{event.type}</span>
                <span className="vp-event-chevron" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
          <div className="vp-archive-footer">Available monthly JPJ series: {earliest} – {latest}</div>
        </section>

        <section className="vp-card vp-selected-event">
          <span className="vp-eyebrow">SELECTED EVENT / {String(EVENTS.findIndex((e) => e.id === eventId) + 1).padStart(2, '0')}</span>
          <div className="vp-event-date-panel">
            <strong>{selected.displayDate}</strong>
          </div>
          <h2>{selected.name}</h2>
          <p className="vp-lead">{selected.mechanism}</p>
          <div className="vp-fact-grid">
            <div>
              <span>EVENT TYPE</span>
              <strong>{selected.type}</strong>
            </div>
            <div>
              <span>RELEVANT VEHICLES</span>
              <strong>{selected.scope}</strong>
            </div>
          </div>
          <div className="vp-event-text" aria-label="Policy context">
            <span className="vp-event-text-label">ABOUT THIS EVENT</span>
            <p>{selected.description}</p>
            <p className="vp-event-text-note">{selected.interpretation}</p>
          </div>
          <div className="vp-event-actions">
            <button
              className="vp-primary-button" type="button"
              onClick={() => detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              View market response <span aria-hidden="true">↗</span>
            </button>
          </div>
        </section>
      </div>

      <section className="vp-card vp-analysis" ref={detailsRef}>
        <div className="vp-analysis-head">
          <div>
            <span className="vp-eyebrow">EVENT WINDOW / OBSERVED JPJ DATA</span>
            <h2>{currentMetric.label} around {selected.displayDate.toLowerCase()}<span>.</span></h2>
            <p>Compare the six months before and after this event. The event month is excluded from the averages.</p>
          </div>
          <div className="vp-controls">
            <label htmlFor="vp-policy-metric">SELECT VARIABLE</label>
            <select
              id="vp-policy-metric"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
            >
              {METRICS.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="vp-metric-note">{currentMetric.about}</p>

        <div className="vp-comparison-grid">
          <SummaryTile
            label="BEFORE · 6-MONTH AVERAGE"
            value={<MetricDisplay value={result.beforeAvg} metric={metric} />}
            description={`${result.before.length} / 6 months available`}
          />
          <SummaryTile
            label="AFTER · 6-MONTH AVERAGE"
            value={<MetricDisplay value={result.afterAvg} metric={metric} />}
            description={`${result.after.length} / 6 months available`}
          />
          <SummaryTile
            label="OBSERVED CHANGE"
            value={deltaText}
            description={result.comparable
              ? (result.isShare ? 'Percentage-point difference' : 'Relative difference')
              : 'A complete six-month window is required'}
          />
        </div>

        {result.months.some((row) => row.value !== null) ? (
          <>
            <div className="vp-chart-toolbar">
              <div className="vp-chart-legend">
                <span><i className="vp-legend-raw" /> Monthly observations</span>
                {showAverage && <span><i className="vp-legend-average" /> 3-month average</span>}
              </div>
              <label className="vp-toggle">
                <input
                  type="checkbox"
                  checked={showAverage}
                  onChange={(e) => setShowAverage(e.target.checked)}
                />
                Smooth line
              </label>
            </div>
            <WindowTrendChart
              rows={result.months}
              metric={metric}
              showAverage={showAverage}
              event={selected}
            />
          </>
        ) : (
          <div className="vp-empty-window">
            <strong>No observed data for this event window.</strong>
            <p>Change the variable or select another event.</p>
          </div>
        )}
        <div className="vp-chart-footnote">
          <span className="vp-signal-dot" />
          <p>These are descriptive changes around a policy date, not evidence that the policy caused the change.</p>
        </div>
      </section>

      <section className="vp-card vp-wide-history">
        <div className="vp-analysis-head">
          <div>
            <span className="vp-eyebrow">FROM YOUR COLAB / FIGURE 3 · 2011–2026</span>
            <h2>EV and Hybrid shares through policy milestones<span>.</span></h2>
            <p>This view follows your original notebook figure, using EV and Hybrid market share so the early low-value period remains visible. Select a marker or an event card below to open its analysis.</p>
          </div>
          <div className="vp-history-mode" role="group" aria-label="Full history view">
            <button type="button" className="is-active">Original figure view</button>
          </div>
        </div>
        <FullHistoryChart metric={metric} notebookShares={true} selectedId={eventId} onSelect={setEventId} />
        <div className="vp-chart-footnote vp-figure-source-note"><span className="vp-signal-dot" />
          <p>Reproduced from your original notebook logic: EV market share and Hybrid market share are both measured as a percentage of all new passenger-car registrations. Data through August 2026.</p>
        </div>
      </section>

      <TaxExemptionComparisonChart />
      <NotebookMethodResults />

      <div className="vp-bottom-grid">
        <section className="vp-card vp-explainer">
          <span className="vp-eyebrow">HOW TO READ THE FIGURES</span>
          <h2>Rise, drop, or no clear shift<span>.</span></h2>
          <p>We compare the arithmetic average for the six complete calendar months on either side of the event. A line can rise or fall without proving that a policy caused it.</p>
          <p>A rolling average makes noisy months easier to read. It is a descriptive smoothing tool, not a counterfactual or statistical significance test.</p>
        </section>
        <section className="vp-card vp-explainer">
          <span className="vp-eyebrow">RESEARCH INTEGRITY</span>
          <h2>Scope and limitations<span>.</span></h2>
          <p>This dataset covers {earliest}–{latest} and shows national passenger-car registrations, not vehicle sales or active vehicles on the road.</p>
          <p>Formal Interrupted Time Series regression and reduced-model significance testing remain in your Assignment Notebook. These charts do not replace those tests.</p>
          <span className="vp-source-note">SOURCE: JPJ / DATA.GOV.MY · DERIVED POLICY_HISTORY.JSON</span>
        </section>
      </div>
    </div>
  );
}
