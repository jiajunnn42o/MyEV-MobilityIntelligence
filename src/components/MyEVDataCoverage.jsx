import React from 'react';
import './MyEVDataCoverage.css';

const integer = new Intl.NumberFormat('en-MY');

function readableMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(value || '')) return 'Selected period';
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

/**
 * The parent GeographicIntelligencePage calculates these totals from the
 * current period/month filter. No extra fetching or independent data source.
 */
export default function MyEVDataCoverage({ coverage, month, period }) {
  const total = Number(coverage?.total);
  const allocated = Number(coverage?.allocated);
  const valid = Number.isFinite(total) && Number.isFinite(allocated) &&
    total >= 0 && allocated >= 0 && allocated <= total;
  const hasRecords = valid && total > 0;
  const unallocated = hasRecords ? total - allocated : 0;
  const assignedPercentage = hasRecords ? (allocated / total) * 100 : 0;
  const unallocatedPercentage = hasRecords ? (unallocated / total) * 100 : 0;
  const dateLabel = readableMonth(month);
  const periodLabel = period === 'month'
    ? dateLabel
    : /^\d{4}-\d{2}$/.test(month || '')
      ? `Jan ${month.slice(0, 4)} – ${dateLabel}`
      : 'Year to date';

  return (
    <section className="vm5-panel myev-coverage" aria-labelledby="myev-coverage-title">
      <div className="myev-coverage-head">
        <span className="vm5-eyebrow">DATA INTEGRITY / QUALITY</span>
        <h2 id="myev-coverage-title">
          Understanding the data<span className="myev-coverage-punct">.</span>
        </h2>
        <p>
          Check how many JPJ registration records can be linked to a state
          before interpreting the map or the ranking.
        </p>
        <span className="myev-coverage-period">Reporting period · {periodLabel}</span>
      </div>

      <div className="myev-coverage-data" aria-live="polite" aria-atomic="true">
        <div className="myev-coverage-value-row">
          <div className="myev-coverage-value">
            <span>KNOWN-STATE COVERAGE</span>
            <strong>{hasRecords ? `${assignedPercentage.toFixed(1)}%` : '—'}</strong>
            <small>{hasRecords ? `${integer.format(allocated)} state-linked records` : 'No data in selected period'}</small>
          </div>
          <div className="myev-coverage-value myev-coverage-value--right">
            <span>UNALLOCATED</span>
            <strong>{hasRecords ? `${unallocatedPercentage.toFixed(1)}%` : '—'}</strong>
            <small>{hasRecords ? `${integer.format(unallocated)} records` : 'No data in selected period'}</small>
          </div>
        </div>

        <div
          className="myev-coverage-track"
          role="progressbar"
          aria-label="Records with an identifiable state"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={hasRecords ? Number(assignedPercentage.toFixed(1)) : undefined}
          aria-valuetext={hasRecords ? `${integer.format(allocated)} of ${integer.format(total)} records` : 'No available records'}
        >
          <span
            className="myev-coverage-track-fill"
            style={{ width: `${assignedPercentage}%` }}
          />
        </div>

        <div className="myev-coverage-legend">
          <span><i className="myev-coverage-dot myev-coverage-dot--known" /> Known state</span>
          <span><i className="myev-coverage-dot myev-coverage-dot--unknown" /> Unallocated / Rakan Niaga</span>
        </div>
        <span
          className="myev-coverage-explanation"
          title="Coverage = registrations with an explicitly recorded state, divided by all JPJ car registration transactions in the selected period."
          tabIndex={0}
        >
          Coverage = known-state records ÷ all registration records
        </span>
      </div>

      <div className="myev-coverage-interpretation">
        <h3>How to interpret the ranking</h3>
        <div className="myev-coverage-guidance">
          <div>
            <span className="myev-coverage-guidance-number">01</span>
            <div>
              <strong>What the numbers represent</strong>
              <p>Registration transactions explicitly recorded against each state.</p>
            </div>
          </div>
          <div>
            <span className="myev-coverage-guidance-number">02</span>
            <div>
              <strong>What they do not represent</strong>
              <p>Statewide EV ownership, adoption rates, or the current location of the vehicles.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="myev-coverage-source">
        <span>DATA SOURCES</span>
        <strong>JPJ · Malaysia Open Data</strong>
        <small>DOSM state boundaries · Coverage updates with the selected reporting period</small>
      </div>
    </section>
  );
}
