import React, { useEffect, useMemo, useRef, useState } from 'react';
import market from '../data/market.json';
import outlook from '../data/forecast_outlooks.json';
import './ForecastIntelligence.css';

// Forecasting is isolated from App.jsx so it cannot alter Iconsax, Chevron,
// Navbar, maps, or other pages. Historical data and M9 are never rewritten.

const HISTORICAL = market.monthly;
const RESEARCH = market.forecast;
const SCENARIOS = outlook.scenarios;
const LIME = '#A9FF19';

const value = (n, d = 2) => `${Number(n).toFixed(d)}%`;
const latest = HISTORICAL[HISTORICAL.length - 1];
const lastM9 = RESEARCH[RESEARCH.length - 1];
const lastBase = SCENARIOS.base.values[SCENARIOS.base.values.length - 1];
const lastLow = SCENARIOS.lower.values[SCENARIOS.lower.values.length - 1];
const lastHigh = SCENARIOS.upper.values[SCENARIOS.upper.values.length - 1];

function linePath(points) {
  return points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');
}

function areaPath(top, bottom) {
  return `${linePath(top)} ${linePath([...bottom].reverse()).replace(/^M/, 'L')} Z`;
}

function yearLabel(month) {
  const [year, mon] = month.split('-');
  return `${year}-${mon}`;
}

function InfoMetric({ eyebrow, number, caption, featured = false }) {
  return (
    <div className={`vf10-metric ${featured ? 'vf10-metric-featured' : ''}`}>
      <span>{eyebrow}</span>
      <strong>{number}</strong>
      <small>{caption}</small>
    </div>
  );
}

function ForecastChart({ mode }) {
  const plotRef = useRef(null);
  const [size, setSize] = useState({ width: 1020, height: 390 });
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const element = plotRef.current;
    if (!element) return undefined;

    const refresh = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height });
      }
    };

    refresh();
    const observer = new ResizeObserver(refresh);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { width: w, height: h } = size;
  const left = w < 520 ? 40 : 53;
  const right = w - (w < 520 ? 14 : 28);
  const top = 30;
  const bottom = h - 47;
  const allDates = useMemo(
    () => [...HISTORICAL.map((r) => r.date), ...RESEARCH.map((r) => r.date)],
    []
  );

  const xx = (index) => left + (right - left) * index / Math.max(1, allDates.length - 1);
  const yy = (percent) => bottom - (bottom - top) * percent / 100;
  const forecastStart = HISTORICAL.length - 1;

  const series = useMemo(() => {
    const scenario = (name) => [
      latest.evOfElectrified,
      ...SCENARIOS[name].values.map((row) => row.value)
    ];

    return {
      observed: HISTORICAL.map((r, index) => [xx(index), yy(r.evOfElectrified)]),
      scenario: scenario('base').map((v, i) => [xx(forecastStart + i), yy(v)]),
      low: scenario('lower').map((v, i) => [xx(forecastStart + i), yy(v)]),
      high: scenario('upper').map((v, i) => [xx(forecastStart + i), yy(v)]),
      m9: [latest.evOfElectrified, ...RESEARCH.map((r) => r.value)]
        .map((v, i) => [xx(forecastStart + i), yy(v)]),
      m9Upper: [latest.evOfElectrified, ...RESEARCH.map((r) => r.upper)]
        .map((v, i) => [xx(forecastStart + i), yy(v)]),
      m9Lower: [latest.evOfElectrified, ...RESEARCH.map((r) => r.lower)]
        .map((v, i) => [xx(forecastStart + i), yy(v)])
    };
  }, [w, h]);

  const scenarioMode = mode === 'scenario';
  const primary = scenarioMode ? series.scenario : series.m9;
  const bandUpper = scenarioMode ? series.high : series.m9Upper;
  const bandLower = scenarioMode ? series.low : series.m9Lower;
  const secondary = scenarioMode ? series.m9 : series.scenario;

  const indexForHover = hover === null ? null : Math.max(0, Math.min(allDates.length - 1, hover));
  const hoverDatum = indexForHover === null ? null : {
    date: allDates[indexForHover],
    value: indexForHover < HISTORICAL.length
      ? HISTORICAL[indexForHover].evOfElectrified
      : scenarioMode
        ? SCENARIOS.base.values[indexForHover - HISTORICAL.length].value
        : RESEARCH[indexForHover - HISTORICAL.length].value,
    phase: indexForHover < HISTORICAL.length ? 'Observed' : scenarioMode ? 'Scenario' : 'M9 conditional'
  };

  const markerX = xx(forecastStart);
  const narrow = w < 540;

  const tickYears = narrow ? ['2022-01', '2026-01', '2030-01']
    : ['2022-01', '2024-01', '2026-01', '2028-01', '2030-01'];

  return (
    <div className="vf10-plot" ref={plotRef}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height="100%"
        role="img"
        aria-label={scenarioMode
          ? 'Measured EV share, an anchored bounded-growth scenario with a sensitivity range, and original M9 comparison'
          : 'Measured EV share and original M9 conditional projection with its prediction interval'}
      >
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line x1={left} x2={right} y1={yy(tick)} y2={yy(tick)} className="vf10-grid-line" />
            <text x={left - 11} y={yy(tick) + 4} className="vf10-axis" textAnchor="end">
              {tick}%
            </text>
          </g>
        ))}

        <path
          d={areaPath(bandUpper, bandLower)}
          fill={LIME}
          opacity={scenarioMode ? 0.12 : 0.15}
        />

        <path
          d={linePath(series.observed)}
          fill="none"
          className="vf10-observed-line"
        />

        <path
          d={linePath(secondary)}
          fill="none"
          className="vf10-secondary-line"
        />

        <path
          d={linePath(primary)}
          fill="none"
          className="vf10-projection-line"
        />

        <line
          x1={markerX}
          x2={markerX}
          y1={top}
          y2={bottom}
          className="vf10-divider-line"
        />
        <text x={Math.min(markerX + 10, right - 100)} y={top + 13} className="vf10-event-label">
          FORECAST BEGINS
        </text>

        {tickYears.map((t) => {
          const i = allDates.findIndex((d) => d === t);
          return i === -1 ? null : (
            <text key={t} x={xx(i)} y={h - 15} className="vf10-axis" textAnchor="middle">
              {t.slice(0, 4)}
            </text>
          );
        })}

        {indexForHover !== null && (
          <g pointerEvents="none">
            <line
              x1={xx(indexForHover)}
              x2={xx(indexForHover)}
              y1={top}
              y2={bottom}
              className="vf10-hover-rule"
            />
            <circle
              cx={xx(indexForHover)}
              cy={yy(hoverDatum.value)}
              r="4.5"
              className="vf10-hover-dot"
            />
          </g>
        )}
        <rect
          x={left}
          y={top}
          width={right - left}
          height={bottom - top}
          fill="transparent"
          onPointerMove={(event) => {
            const rect = event.currentTarget.ownerSVGElement.getBoundingClientRect();
            const local = event.clientX - rect.left;
            const index = Math.round((local - left) / (right - left) * (allDates.length - 1));
            setHover(Math.max(0, Math.min(allDates.length - 1, index)));
          }}
          onPointerLeave={() => setHover(null)}
        />
      </svg>

      {hoverDatum && (
        <div
          className="vf10-chart-tooltip"
          style={{ left: `${Math.min(Math.max(xx(indexForHover), 90), w - 90)}px` }}
        >
          <span>{yearLabel(hoverDatum.date)} · {hoverDatum.phase}</span>
          <strong>{value(hoverDatum.value)}</strong>
        </div>
      )}
    </div>
  );
}

function Key({ kind, children }) {
  return (
    <span className="vf10-chart-key">
      <i className={`vf10-key-swatch vf10-key-${kind}`} />
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------
   New-user guide: all headline numbers are taken from the
   existing historical JPJ data, original M9, or labeled scenarios.
   No values are fabricated and the original model is unchanged.
   --------------------------------------------------------------- */
function ReadingGuide() {
  return (
    <section className="vf11-guide" aria-label="How to use forecasting">
      <div className="vf11-section-head">
        <div>
          <span className="vf10-eyebrow">START HERE / 30-SECOND GUIDE</span>
          <h2>What can this page tell you?</h2>
        </div>
        <span className="vf11-quiet-tag">3 THINGS TO KNOW</span>
      </div>
      <div className="vf11-guide-grid">
        <article>
          <span className="vf11-guide-index">01 / MEASURE</span>
          <h3>How quickly is EV adoption changing?</h3>
          <p>Follow the black line to understand the share of electric cars among new EV and hybrid registrations.</p>
        </article>
        <article>
          <span className="vf11-guide-index">02 / COMPARE</span>
          <h3>What could happen next?</h3>
          <p>Switch between a growth <strong>what-if scenario</strong> and the original <strong>M9 statistical forecast</strong>.</p>
        </article>
        <article>
          <span className="vf11-guide-index">03 / EVALUATE</span>
          <h3>How certain is the result?</h3>
          <p>Check the model assumptions and see why a scenario range is different from a prediction interval.</p>
        </article>
      </div>
    </section>
  );
}

function ShareExplainer() {
  const historical = latest;
  const ev = Number(historical.ev);
  const hybrid = Number(historical.hybrid);
  const share = Number(historical.evOfElectrified);
  const allCarsShare = Number(historical.evShare);
  const fmtNum = (n) => new Intl.NumberFormat('en-MY').format(n);

  return (
    <section className="vf11-definition" aria-label="EV share definition">
      <div>
        <span className="vf10-eyebrow">UNDERSTANDING THE METRIC</span>
        <h2>EV share does not mean all cars.</h2>
        <p>
          This page measures <strong>EV / (EV + Hybrid)</strong>. It shows how electric
          vehicles compare with hybrids among these two registration categories.
        </p>
      </div>
      <div className="vf11-calculation">
        <span className="vf11-calculation-label">AUGUST 2026 · REAL JPJ COUNTS</span>
        <div className="vf11-formula">
          <span>{fmtNum(ev)} EV</span>
          <span className="vf11-symbol">÷</span>
          <span>({fmtNum(ev)} EV + {fmtNum(hybrid)} Hybrid)</span>
          <span className="vf11-symbol">=</span>
          <strong>{value(share)}</strong>
        </div>
        <small>EV share among <em>all</em> newly registered cars is only {value(allCarsShare)}. These measures are not interchangeable.</small>
      </div>
    </section>
  );
}

function HorizonPreview() {
  const [horizon, setHorizon] = useState(6);
  const index = horizon - 1;
  const base = SCENARIOS.base.values[index];
  const original = RESEARCH[index];
  const low = SCENARIOS.lower.values[index];
  const high = SCENARIOS.upper.values[index];
  const when = new Date(`${base.date}-01T00:00:00`).toLocaleDateString('en-GB', {
    month: 'long', year: 'numeric'
  });

  return (
    <section className="vf11-horizon-card" aria-label="Near-term outlook comparison">
      <div className="vf11-section-head">
        <div>
          <span className="vf10-eyebrow">NEAR-TERM OUTLOOK / 6–12 MONTHS</span>
          <h2>Compare the numbers, not just the lines.</h2>
          <p>Choose a horizon to see what each existing path implies after August 2026.</p>
        </div>
        <div className="vf11-horizon-switch" role="group" aria-label="Forecast horizon">
          {[6, 12].map((n) => (
            <button
              type="button"
              key={n}
              aria-pressed={horizon === n}
              className={horizon === n ? 'is-active' : ''}
              onClick={() => setHorizon(n)}
            >
              {n} months
            </button>
          ))}
        </div>
      </div>
      <p className="vf11-as-of">Target month: <strong>{when}</strong> · Both are EV / (EV + Hybrid), not all-car EV share.</p>
      <div className="vf11-horizon-grid">
        <div className="vf11-horizon-column">
          <div className="vf11-horizon-title"><span className="vf11-swatch vf11-swatch-lime" /> Bounded growth scenario</div>
          <strong className="vf11-forecast-value">{value(base.value)}</strong>
          <p>Assumes an 85% long-run ceiling and a robust historical growth parameter.</p>
          <small>80–95% ceiling assumptions produce {value(low.value, 1)}–{value(high.value, 1)}; <b>not</b> a 95% interval.</small>
        </div>
        <div className="vf11-horizon-column">
          <div className="vf11-horizon-title"><span className="vf11-swatch vf11-swatch-dark" /> Original M9 · Logistic + AR(1)</div>
          <strong className="vf11-forecast-value">{value(original.value)}</strong>
          <p>The original fitted research output, which moves back toward its lower long-run level.</p>
          <small>Conditional 95% prediction interval: {value(original.lower, 1)}–{value(original.upper, 1)}.</small>
        </div>
      </div>
      <p className="vf11-horizon-foot">These are two <strong>different assumptions/models</strong>, not two independently validated winning forecasts. Compare their logic before using either for decisions.</p>
    </section>
  );
}

function ModelReadme() {
  return (
    <section className="vf11-models" aria-label="Choosing and validating a forecasting model">
      <div className="vf11-section-head">
        <div>
          <span className="vf10-eyebrow">MODEL TRANSPARENCY / BEGINNER FRIENDLY</span>
          <h2>Which method is right for the question?</h2>
          <p>A more complicated model is not automatically a more accurate one.</p>
        </div>
      </div>
      <div className="vf11-table-scroller" role="region" aria-label="Forecast method comparison" tabIndex={0}>
        <table className="vf11-model-table">
          <thead>
            <tr><th scope="col">Approach</th><th scope="col">What it answers</th><th scope="col">Main limitation</th><th scope="col">Use in MyEV</th></tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Linear / Quadratic</th>
              <td>Is the historic trend straight or changing speed?</td>
              <td>Extrapolation can move outside 0–100%.</td>
              <td>Research benchmarks</td>
            </tr>
            <tr>
              <th scope="row">M9 · Logistic + AR(1)</th>
              <td>What does a bounded fit with serially correlated errors imply?</td>
              <td>Its fitted ceiling is below the latest observation.</td>
              <td>Original research output</td>
            </tr>
            <tr>
              <th scope="row">Bounded scenario</th>
              <td>What if growth continues toward an assumed market ceiling?</td>
              <td>The chosen ceiling is an assumption, not validated accuracy.</td>
              <td>Exploration and planning</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="vf11-model-note">
        <strong>How accuracy should be checked:</strong> train using past months, forecast genuinely unseen months,
        then compare errors using RMSE / MAE and repeated rolling-origin tests. The website does not
        recompute comparable 6- or 12-month backtest scores for all methods yet, so it does not rank a winner.
      </div>
    </section>
  );
}

function LearningGlossary() {
  return (
    <section className="vf11-glossary" aria-label="Key forecasting terms explained">
      <div className="vf11-section-head">
        <div>
          <span className="vf10-eyebrow">LEARN AS YOU EXPLORE</span>
          <h2>Forecast terminology, made simple.</h2>
        </div>
      </div>
      <div className="vf11-faq-grid">
        <details>
          <summary>What is M9 and what does AR(1) mean?</summary>
          <p>M9 is the ninth candidate from the original assignment. Logistic describes a bounded S-shaped path. AR(1) accounts for dependence between errors in adjacent months.</p>
        </details>
        <details>
          <summary>Is 59.13% an EV share of all Malaysian cars?</summary>
          <p>No. It is the original model's December 2030 estimate of EV registrations divided by EV plus hybrid registrations. The denominator is not all cars.</p>
        </details>
        <details>
          <summary>What is a prediction interval?</summary>
          <p>An interval estimated by a statistical model to communicate uncertainty for future observations, conditional on the model and assumptions. It is not a promise or a guarantee.</p>
        </details>
        <details>
          <summary>Why is the scenario range not a 95% interval?</summary>
          <p>It comes from changing assumed market ceilings (80%, 85%, 95%), not from a probability calculation. We label it an assumption range to avoid a false impression of statistical certainty.</p>
        </details>
        <details>
          <summary>What can change the actual outcome?</summary>
          <p>Charging coverage, electricity supply, vehicle prices, incentives, model availability, and broader economic factors. These are not all modeled by the existing regression.</p>
        </details>
        <details>
          <summary>How often will the forecast update?</summary>
          <p>Not automatically in this prototype. The JPJ dataset must be refreshed and the modeling pipeline rerun. Every result should display its data cutoff and model version.</p>
        </details>
      </div>
    </section>
  );
}

export default function ForecastIntelligence() {
  const [mode, setMode] = useState('scenario');
  const isScenario = mode === 'scenario';

  return (
    <main className="page inner-page vf10-page">
      <section className="vf10-header">
        <div>
          <span className="vf10-eyebrow"><span className="vf10-live-dot" /> 03 / PREDICTIVE INTELLIGENCE</span>
          <h1>Forecasts, with context<span>.</span></h1>
          <p>
            Malaysia's transition from hybrid to electric vehicles: compare an assumption-led
            growth scenario with the original M9 research model, without conflating the two.
          </p>
        </div>
        <div className="vf10-header-tag">JPJ DATA · THROUGH AUG 2026</div>
      </section>

      <ReadingGuide />
      <ShareExplainer />

      <div className="vf10-control-row">
        <div className="vf10-mode-selector" role="group" aria-label="Forecast perspective">
          <button
            type="button"
            className={isScenario ? 'active' : ''}
            onClick={() => setMode('scenario')}
            aria-pressed={isScenario}
          >
            Bounded growth scenario
          </button>
          <button
            type="button"
            className={!isScenario ? 'active' : ''}
            onClick={() => setMode('m9')}
            aria-pressed={!isScenario}
          >
            Original research · M9
          </button>
        </div>
        <span className="vf10-mode-note">
          {isScenario ? 'Illustrative assumptions · not the validated M9 forecast' : 'Original fitted model · conditional interval'}
        </span>
      </div>

      <section className="vf10-metric-row">
        <InfoMetric
          eyebrow="LAST OBSERVED · AUG 2026"
          number={value(latest.evOfElectrified)}
          caption="EV / (EV + Hybrid) registrations"
        />
        <InfoMetric
          featured
          eyebrow={isScenario ? 'DEC 2030 · BASE SCENARIO' : 'DEC 2030 · ORIGINAL M9'}
          number={isScenario ? value(lastBase.value) : value(lastM9.value)}
          caption={isScenario ? 'Anchored logistic path, assuming K = 85%' : 'Conditional statistical model output'}
        />
        <InfoMetric
          eyebrow={isScenario ? 'DEC 2030 · SENSITIVITY RANGE' : '95% CONDITIONAL PREDICTION INTERVAL'}
          number={isScenario
            ? `${value(lastLow.value, 1)} – ${value(lastHigh.value, 1)}`
            : `${value(lastM9.lower)} – ${value(lastM9.upper)}`}
          caption={isScenario
            ? 'Ceilings of 80–95%; not a confidence interval'
            : 'Excludes parameter and policy uncertainty'}
        />
      </section>

      <section className="vf10-chart-card" aria-label="EV adoption forecast chart">
        <div className="vf10-chart-heading">
          <div>
            <span className="vf10-eyebrow">HISTORICAL REGISTRATIONS / FUTURE OUTLOOK</span>
            <h2>Observed adoption. Alternative futures<span>.</span></h2>
            <p>EV share within EV + Hybrid passenger-car registrations, not share of all vehicles.</p>
          </div>
          <span className="vf10-data-tag">2022—2030</span>
        </div>
        <ForecastChart mode={mode} />
        <div className="vf10-chart-footer">
          <div className="vf10-chart-legend">
            <Key kind="observed">Observed</Key>
            <Key kind="primary">{isScenario ? 'Bounded scenario' : 'Original M9 forecast'}</Key>
            <Key kind="secondary">{isScenario ? 'Original M9 (reference)' : 'Bounded scenario (reference)'}</Key>
            <Key kind="band">{isScenario ? 'Assumption range, NOT 95% PI' : '95% conditional PI'}</Key>
          </div>
          <span className="vf10-chart-source">Source: JPJ / MyEV research data</span>
        </div>
      </section>

      <section className="vf10-insight-strip" aria-label="Forecast interpretation">
        <span className="vf10-insight-label">READING THE OUTLOOK</span>
        <p>
          {isScenario
            ? 'The green curve begins at the latest measured EV share and approaches an assumed 85% ceiling. This is a what-if scenario, not proof that future adoption must rise.'
            : 'M9 converges toward its fitted long-run level, below the latest observation. This is why the research curve initially declines; the model should not be advertised as inevitable growth.'}
        </p>
      </section>

      <HorizonPreview />
      <ModelReadme />
      <LearningGlossary />

      <section className="vf10-explain-grid">
        <article className="vf10-explain-card">
          <span className="vf10-eyebrow">01 / HOW THIS VIEW IS BUILT</span>
          <h3>{isScenario ? 'An anchored, bounded scenario.' : 'The original M9 fit.'}</h3>
          {isScenario ? (
            <>
              <p>
                The scenario starts at the measured August 2026 EV share. Its growth parameter
                is estimated using a robust median slope of capped log-odds over the most recent
                24 observations; the long-run ceiling is an explicit assumption.
              </p>
              <div className="vf10-detail-list">
                <div><span>Base ceiling (K)</span><strong>85%</strong></div>
                <div><span>Growth (capped log-odds / month)</span><strong>{SCENARIOS.base.growth_per_month.toFixed(3)}</strong></div>
                <div><span>Reference ceiling sensitivity</span><strong>80% / 95%</strong></div>
              </div>
            </>
          ) : (
            <>
              <p>
                This is the existing academic Logistic + AR(1) forecast from your research.
                The 95% band is conditional on fitted model parameters. We preserve it exactly
                rather than editing its numerical output to create a more attractive curve.
              </p>
              <div className="vf10-detail-list">
                <div><span>Estimated long-run ceiling</span><strong>59.13%</strong></div>
                <div><span>Latest observed value</span><strong>64.02%</strong></div>
                <div><span>Conditional 2030 interval</span><strong>47.36% – 70.90%</strong></div>
              </div>
            </>
          )}
        </article>
        <article className="vf10-explain-card">
          <span className="vf10-eyebrow">02 / WHAT TO KEEP IN MIND</span>
          <h3>Useful, not certain.</h3>
          <p>
            A larger EV share in the EV + Hybrid market does not automatically imply an equivalent
            share of all car registrations or lower transport emissions. Both outlooks depend on
            policy, prices, supply and charging infrastructure beyond this data.
          </p>
          <div className="vf10-method-note">
            <span className="vf10-method-dot" />
            {isScenario
              ? 'The shaded spread shows assumption sensitivity. It is not a statistical 95% interval and is not a backtested replacement for M9.'
              : 'The shaded M9 band is a conditional prediction interval, not a guarantee of future outcomes. Model selection still requires out-of-sample validation.'}
          </div>
        </article>
      </section>
    </main>
  );
}
