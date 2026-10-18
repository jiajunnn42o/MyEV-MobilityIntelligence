import React, { useEffect, useMemo, useRef, useState } from 'react';
import research from '../data/notebook_research.json';
import './ResearchIntelligence.css';

/*
  Notebook Research v19
  Saved regression and validation results are exported from the original Colab.
  Decomposition is recomputed from the same JPJ CSV using the notebook settings.
  No regression fitting takes place in the browser.
*/

const MODULES = [
  ['totalCars', 'All passenger cars', 'Total registrations'],
  ['electric', 'Electric vehicles', 'EV registrations'],
  ['hybrid', 'Hybrid vehicles', 'Hybrid registrations'],
  ['evShare', 'EV among electrified', 'EV / (EV + Hybrid)'],
];
const COMPONENTS = [
  ['observed', 'Observed', 'Actual reported monthly value'],
  ['trend', 'Trend', 'Smoothed long-term direction'],
  ['seasonal', 'Seasonality', 'Recurring monthly component'],
  ['residual', 'Residual', 'Remainder not explained by trend and seasonality'],
];
const fmt = (value, digits = 1) =>
  Number.isFinite(value)
    ? value.toLocaleString('en-MY', { maximumFractionDigits: digits, minimumFractionDigits: digits })
    : '—';
const compact = (value) => {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000000) return `${fmt(value / 1000000)}m`;
  if (Math.abs(value) >= 1000) return `${fmt(value / 1000)}k`;
  return fmt(value, Math.abs(value) >= 10 ? 0 : 1);
};
const monthLabel = (text) => {
  const [year, month] = text.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', {
    month: 'short', year: 'numeric', timeZone: 'UTC',
  });
};

function Chevron({ expanded }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d={expanded ? 'm5 15 7-7 7 7' : 'm5 9 7 7 7-7'} />
    </svg>
  );
}

function SectionHeader({ eyebrow, title, description, aside }) {
  return (
    <header className="ri-heading">
      <div className="ri-heading-text">
        <span className="ri-overline">{eyebrow}</span>
        <h2>{title}<span className="ri-dot">.</span></h2>
        <p>{description}</p>
      </div>
      {aside && <div className="ri-heading-aside">{aside}</div>}
    </header>
  );
}

function Statistic({ label, value, note }) {
  return (
    <div className="ri-stat">
      <span className="ri-overline">{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function ResearchPlot({ rows, dataKey, unit, type, title, height = 190 }) {
  const hostRef = useRef(null);
  const [width, setWidth] = useState(560);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const measure = () => setWidth(Math.max(310, Math.floor(host.clientWidth)));
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(host);
    return () => observer?.disconnect();
  }, []);
  const pad = { left: 52, right: 18, top: 16, bottom: 31 };
  const graphW = Math.max(1, width - pad.left - pad.right);
  const graphH = height - pad.top - pad.bottom;
  const actual = rows.map((row, index) => ({ index, month: row.month, value: row[dataKey] }));
  const valid = actual.filter((row) => Number.isFinite(row.value));
  const numbers = valid.map((row) => row.value);
  let lo = Math.min(0, ...numbers);
  let hi = Math.max(1, ...numbers);
  if (numbers.some((v) => v < 0) || type === 'residual' || (type === 'seasonal' && unit !== 'ratio')) {
    lo = Math.min(...numbers);
    hi = Math.max(...numbers);
  }
  const span = Math.max(0.0001, hi - lo);
  lo -= span * 0.08;
  hi += span * 0.08;
  const x = (i) => pad.left + (i / Math.max(1, actual.length - 1)) * graphW;
  const y = (v) => pad.top + ((hi - v) / Math.max(0.0001, hi - lo)) * graphH;
  const segments = [];
  let part = [];
  actual.forEach((row) => {
    if (Number.isFinite(row.value)) part.push(row);
    else { if (part.length > 1) segments.push(part); part = []; }
  });
  if (part.length > 1) segments.push(part);
  const formatY = (v) => unit === 'percentage points' ? `${fmt(v)}%` : type === 'seasonal' && unit === 'vehicles' && dataKey === 'seasonal' && rows.length === 56 && numbers.every((n) => n > 0) && Math.max(...numbers) < 3 ? `${fmt(v, 2)}×` : compact(v);
  const tooltip = hover === null ? null : actual[hover];
  const ticks = [0, 0.5, 1];
  const indexTicks = [0, Math.floor((actual.length - 1) / 2), actual.length - 1];
  return (
    <div className="ri-chart" ref={hostRef}>
      <div className="ri-chart-title">{title}</div>
      {tooltip && Number.isFinite(tooltip.value) && (
        <div className="ri-chart-tooltip"><b>{monthLabel(tooltip.month)}</b><span>{formatY(tooltip.value)}</span></div>
      )}
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${title}: ${rows.length} months, ${unit}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={pad.top + t * graphH} y2={pad.top + t * graphH} stroke="currentColor" strokeOpacity=".11" strokeDasharray="4 5" />
            <text x={pad.left - 10} y={pad.top + t * graphH + 4} textAnchor="end" className="ri-axis">{formatY(hi - t * (hi - lo))}</text>
          </g>
        ))}
        {lo < 0 && hi > 0 && <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity=".21" />}
        {segments.map((points, i) => (
          <path key={i} d={points.map((p, j) => `${j ? 'L' : 'M'}${x(p.index).toFixed(2)} ${y(p.value).toFixed(2)}`).join(' ')} fill="none" stroke={dataKey === 'trend' ? '#171918' : dataKey === 'observed' ? '#A9FF19' : '#7F8884'} strokeWidth="2.1" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {indexTicks.map((index, i) => <text key={i} x={x(index)} y={height - 7} className="ri-axis" textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>{monthLabel(actual[index].month)}</text>)}
        {tooltip && Number.isFinite(tooltip.value) && (
          <g pointerEvents="none">
            <line x1={x(hover)} y1={pad.top} x2={x(hover)} y2={pad.top + graphH} stroke="#A9FF19" strokeDasharray="3 4" />
            <circle cx={x(hover)} cy={y(tooltip.value)} r="4" fill="#A9FF19" stroke="#171918" strokeWidth="1.3" />
          </g>
        )}
        <rect x={pad.left} y={pad.top} width={graphW} height={graphH} fill="transparent" onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
          setHover(Math.round(fraction * (actual.length - 1)));
        }} onMouseLeave={() => setHover(null)} />
      </svg>
    </div>
  );
}

export function MarketSeasonalitySection() {
  const [selected, setSelected] = useState('evShare');
  const [showHelp, setShowHelp] = useState(false);
  const item = research.decomposition[selected];
  const relative = item.model === 'multiplicative';
  const seasonalVals = item.seasonal_factors.filter((row) => Number.isFinite(row.value));
  const peak = seasonalVals.reduce((best, next) => next.value > best.value ? next : best, seasonalVals[0]);
  const low = seasonalVals.reduce((best, next) => next.value < best.value ? next : best, seasonalVals[0]);
  const variance = research.seasonality.component_variance_pct;
  return (
    <section className="ri-module ri-market" id="market-seasonality" aria-label="Trend and seasonality analysis">
      <SectionHeader eyebrow="RESEARCH / HISTORICAL STRUCTURE" title="What drives the monthly changes" description="See how observed registrations separate into longer-term trend, recurring seasonality and unexplained movements. The charts use the same 12-month decomposition settings as Assignment 1." aside={<span className="ri-data-pill">JPJ · through Aug 2026</span>} />
      <div className="ri-toolbar" role="group" aria-label="Choose a time series">
        {MODULES.map(([id, label]) => <button key={id} type="button" className={selected === id ? 'is-active' : ''} onClick={() => setSelected(id)} aria-pressed={selected === id}>{label}</button>)}
      </div>
      <div className="ri-stats ri-stats-market">
        <Statistic label="DECOMPOSITION" value={item.model === 'additive' ? 'Additive' : 'Multiplicative'} note="Original notebook selection" />
        <Statistic label="RECURRING HIGH" value={peak.month} note={relative ? `${fmt(peak.value, 2)}× seasonal factor` : `${item.unit === 'percentage points' ? `${fmt(peak.value, 2)} pp` : `${fmt(peak.value, 0)} vehicles`}`} />
        <Statistic label="RECURRING LOW" value={low.month} note={relative ? `${fmt(low.value, 2)}× seasonal factor` : `${item.unit === 'percentage points' ? `${fmt(low.value, 2)} pp` : `${fmt(low.value, 0)} vehicles`}`} />
        <Statistic label="OBSERVATION WINDOW" value={`${item.count} months`} note={item.range} />
      </div>
      <div className="ri-plot-grid">
        {COMPONENTS.map(([key, label]) => (
          <div className="ri-plot-card" key={`${selected}-${key}`}>
            <ResearchPlot rows={item.series} dataKey={key} title={selected === 'totalCars' && key === 'observed' ? 'Observed (shock-adjusted)' : label} unit={item.unit} type={key} />
          </div>
        ))}
      </div>
      <div className="ri-conclusion">
        {selected === 'evShare' ? (
          <>
            <div className="ri-inline-variance"><span>Trend <strong>{fmt(variance.trend)}%</strong></span><span>Seasonal <strong>{fmt(variance.seasonal)}%</strong></span><span>Residual <strong>{fmt(variance.resid)}%</strong></span></div>
            <p>In the Notebook, trend accounts for most of the summed component variances. The HAC joint month-dummy Wald test gave <b>p = {research.seasonality.p_value}</b>; months are not jointly significant at 5% in that specification. This does <b>not</b> mean there is no month-to-month variation.</p>
          </>
        ) : (
          <p>{relative ? 'EV uses multiplicative decomposition, so seasonal and residual components are relative factors. Missing trend endpoints are intentionally shown as gaps, matching the Notebook.' : selected === 'totalCars' ? 'The Notebook flags and interpolates unusually strong total-car shock months for decomposition only. The original JPJ counts are not changed.' : 'The selected series uses additive decomposition, so seasonal and residual components are on the same numeric scale as observed registrations.'} Decomposition explains historical structure; it does not by itself produce a validated forecast.</p>
        )}
      </div>
      <button type="button" className="ri-explain-toggle" onClick={() => setShowHelp(!showHelp)} aria-expanded={showHelp}>
        How should I read these four charts? <Chevron expanded={showHelp} />
      </button>
      {showHelp && <div className="ri-help-panel">Observed is what JPJ reported. Trend smooths longer changes. Seasonal captures repeatable calendar patterns. Residual is whatever remains; unexpected policy or supply shocks may appear here, but the decomposition alone does not identify causes. Some series use Multiplicative rather than Additive units.</div>}
      <footer className="ri-provenance">Notebook Figures 7–12 · {research.provenance.source_csv} · additive/multiplicative period = 12</footer>
    </section>
  );
}

function HoldoutPanel() {
  const [measure, setMeasure] = useState('RMSE_pp');
  const models = useMemo(() => [...research.holdout].sort((a,b) => a[measure] - b[measure]), [measure]);
  const maximum = Math.max(...models.map((m) => m[measure]));
  const best = models[0];
  return <div className="ri-tab-content">
    <div className="ri-stats ri-stats-forecast">
      <Statistic label="BEST IN THIS HOLD-OUT" value={best.Model} note={`Lowest ${measure === 'RMSE_pp' ? 'RMSE' : 'MAE'} · ${fmt(best[measure],3)} percentage points`} />
      <Statistic label="TRAINING" value="44 months" note="Jan 2022 – Aug 2025" />
      <Statistic label="TEST PERIOD" value="12 months" note="Sep 2025 – Aug 2026" />
    </div>
    <div className="ri-tab-intro"><strong>Which model predicted held-out months more accurately?</strong><p>Lower RMSE or MAE is better. These scores came from training each model only on the first 44 months, then comparing its predictions against the next 12 months. The data include a policy transition, so this is a demanding test.</p></div>
    <div className="ri-toolbar" role="group" aria-label="Hold-out error metric">
      {[['RMSE_pp','RMSE'],['MAE_pp','MAE']].map(([k,v]) => <button key={k} type="button" className={measure===k?'is-active':''} onClick={()=>setMeasure(k)}>{v} (pp)</button>)}
    </div>
    <div className="ri-ranking" role="img" aria-label={`Holdout ${measure} ranking from the Colab notebook`}>
      {models.map((m, i) => <div key={m.Model} className="ri-ranking-row">
        <div className="ri-ranking-label"><span>{m.Model}</span>{i===0 && <span className="ri-mini-tag">Lowest error</span>}</div>
        <div className="ri-ranking-track"><div className="ri-ranking-fill" style={{width:`${Math.max(2,m[measure] / maximum *100)}%`}} data-best={i === 0 ? 'true' : undefined}/></div>
        <strong>{fmt(m[measure],3)}</strong>
      </div>)}
    </div>
    <p className="ri-footnote">In this hold-out, <b>M2 Quadratic outperformed M9</b>. M9's strong in-sample fit does not imply the best next-year forecast. The original Notebook excluded policy-dependent M5 from this specific hold-out.</p>
    <details className="ri-details"><summary>See original Notebook hold-out chart <Chevron expanded={false}/></summary><img src="/data/notebook_fig17_holdout.png" alt="Original Colab Figure 17: model hold-out forecasts versus observed EV share" loading="lazy"/><small>Original Figure 17 image from your saved Notebook; not a chart generated with invented forecast values.</small></details>
  </div>;
}

function InSamplePanel() {
  const [sortBy,setSortBy] = useState('AIC_same_share_scale');
  const [open,setOpen] = useState('M9 Logistic ceiling + AR(1)');
  const models = useMemo(() => [...research.model_comparison].sort((a,b)=>a[sortBy]-b[sortBy]),[sortBy]);
  const chosen = research.model_comparison.find(m=>m.Model===open);
  return <div className="ri-tab-content">
    <div className="ri-stats ri-stats-forecast">
      <Statistic label="LOWEST AIC / BIC" value="M9 Logistic + AR(1)" note="Best in-sample information criteria" />
      <Statistic label="M9 IN-SAMPLE RMSE" value="5.43 pp" note="Not the 12-month hold-out error" />
      <Statistic label="MODELS COMPARED" value="7" note="Same-share-scale likelihood" />
    </div>
    <div className="ri-tab-intro"><strong>Which model fits the observed series?</strong><p>AIC / BIC measure penalised in-sample fit, not future forecasting skill. The Notebook converts likelihoods to a comparable EV-share scale. OLS Adjusted R² is only comparable when the dependent variable is on the same scale.</p></div>
    <div className="ri-toolbar" role="group" aria-label="Sort regression models">
      {[['AIC_same_share_scale','AIC'],['BIC_same_share_scale','BIC'],['RMSE_pp','Fit RMSE']].map(([k,v]) => <button key={k} className={sortBy===k?'is-active':''} type="button" onClick={()=>setSortBy(k)}>{v}</button>)}
    </div>
    <div className="ri-table-scroll"><table className="ri-table"><thead><tr><th>Model</th><th>AIC</th><th>BIC</th><th>Fit RMSE (pp)</th><th>Share-scale R² *</th></tr></thead><tbody>
      {models.map(m=><tr key={m.Model} className={m.Model===open?'is-selected':''} onClick={()=>setOpen(m.Model)}><td><button className="ri-row-button" onClick={()=>setOpen(m.Model)}>{m.Model}</button></td><td>{fmt(m.AIC_same_share_scale,2)}</td><td>{fmt(m.BIC_same_share_scale,2)}</td><td>{fmt(m.RMSE_pp,2)}</td><td>{fmt(m.In_sample_R2_share,3)}</td></tr>)}
    </tbody></table></div>
    {chosen && <div className="ri-selected-model"><span className="ri-overline">SELECTED MODEL</span><strong>{chosen.Model}</strong><p>ΔAIC: {fmt(chosen.Delta_AIC,2)} · Ljung–Box residual p(12): {fmt(chosen.Ljung_Box_p,4)} · Durbin–Watson: {fmt(chosen.Durbin_Watson,3)}</p></div>}
    <p className="ri-footnote">* Descriptive share-scale R² is not OLS Adjusted R², especially for transformed and nonlinear models. Do not use it to claim that M9 has a higher Adjusted R² than M2.</p>
  </div>;
}

function M5Panel() {
  const full = research.m5_comparison[0];
  const reduced = research.m5_comparison[1];
  return <div className="ri-tab-content">
    <div className="ri-tab-intro"><strong>Why remove variables from the Interrupted Time Series?</strong><p>Full M5 originally included Trend, RUSH, POST and POST_T. Under the Notebook's HAC significance-based reduction, RUSH and POST_T were removed; Trend and POST were kept.</p></div>
    <div className="ri-m5-grid">
      <article className="ri-m5-card"><span className="ri-overline">FULL M5</span><h3>{fmt(full.Adjusted_R_squared_logit,4)}</h3><small>Adjusted R² · logit scale</small><div className="ri-chips"><span>Trend</span><span>RUSH</span><span>POST</span><span>POST_T</span></div></article>
      <article className="ri-m5-card"><span className="ri-overline">REDUCED M5</span><h3>{fmt(reduced.Adjusted_R_squared_logit,4)}</h3><small>Adjusted R² · logit scale</small><div className="ri-chips"><span>Trend</span><span>POST</span></div></article>
    </div>
    <div className="ri-m5-flow"><span>RUSH removed <strong>p = 0.9645</strong></span><span>POST_T removed <strong>p = 0.1874</strong></span><span>Reduced specification retained</span></div>
    <div className="ri-model-coefficients">
      <span className="ri-overline">REDUCED M5 / HAC REGRESSION COEFFICIENTS</span>
      <div className="ri-table-scroll"><table className="ri-table"><thead><tr><th>Predictor</th><th>Estimate (log-odds)</th><th>Std. error</th><th>95% CI</th><th>p-value</th></tr></thead><tbody>
        {research.m5_reduced_coefficients.map((c) => <tr key={c.term}><td>{c.term}</td><td>{fmt(c.estimate,4)}</td><td>{fmt(c.std_error,3)}</td><td>{fmt(c.ci_lower,3)} to {fmt(c.ci_upper,3)}</td><td>{c.p_value}</td></tr>)}
      </tbody></table></div>
    </div>
    <p className="ri-footnote">Both Adjusted R² values are on the logit EV-share scale, so this comparison is appropriate. Coefficients describe changes in log-odds, not percentage-point changes. The POST start date was selected exploratorily; policy effects are not proven causal by this regression alone.</p>
  </div>;
}

function DiagnosticsPanel() {
  const model = research.model_comparison.find(m=>m.Model==='M9 Logistic ceiling + AR(1)');
  return <div className="ri-tab-content">
    <div className="ri-stats ri-stats-forecast">
      <Statistic label="M9 LJUNG–BOX p(12)" value={fmt(model.Ljung_Box_p,4)} note="Residual autocorrelation test" />
      <Statistic label="M9 DURBIN–WATSON" value={fmt(model.Durbin_Watson,3)} note="Residual dependence diagnostic" />
      <Statistic label="M9 AR(1) PHI" value="0.4291" note="Estimated residual persistence" />
    </div>
    <div className="ri-tab-intro"><strong>What is left after fitting the model?</strong><p>The Notebook checks residual movements over time, autocorrelation, distribution and normality. The M9 residual Ljung–Box p-value does not reject the no-autocorrelation null at 5% for 12 lags, but that does not prove all modelling assumptions hold.</p></div>
    <figure className="ri-original-figure"><img src="/data/notebook_fig16_m9_diagnostics.png" alt="Original saved Colab Figure 16 showing M9 residual time series, autocorrelation, histogram and normal Q-Q plot" loading="lazy"/><figcaption>Actual Figure 16 from your Notebook (saved output), not a recreated diagnostic.</figcaption></figure>
    <div className="ri-table-scroll"><table className="ri-table"><thead><tr><th>Parameter</th><th>Estimate</th><th>Std. error</th><th>p-value</th></tr></thead><tbody>{research.m9_parameters.map(m=><tr key={m.Model}><td>{m.Model}</td><td>{fmt(m.Estimate,4)}</td><td>{fmt(m.Std_Error,4)}</td><td>{m.p_value===0?'<0.0001':fmt(m.p_value,4)}</td></tr>)}</tbody></table></div>
  </div>;
}

const VIEWS=[['holdout','Hold-out accuracy'],['insample','Regression comparison'],['m5','M5 reduction'],['diagnostics','Diagnostics']];
export function ForecastResearchSection() {
  const [tab, setTab] = useState('holdout');
  return <section className="ri-module ri-forecast" id="forecast-research" aria-label="Notebook regression and validation research">
    <SectionHeader eyebrow="RESEARCH NOTEBOOK / MODEL EVIDENCE" title="How reliable are the models" description="Interactive research results from your original Assignment 1: model selection, hold-out accuracy, variable reduction and residual diagnostics. Figures are not recalculated with new assumptions." aside={<span className="ri-data-pill">Original Colab · n = 56</span>}/>
    <div className="ri-toolbar ri-tabs" role="tablist" aria-label="Regression analysis sections">
      {VIEWS.map(([key,label])=><button key={key} id={`ri-tab-${key}`} role="tab" aria-controls={`ri-panel-${key}`} aria-selected={tab===key} type="button" className={tab===key?'is-active':''} onClick={()=>setTab(key)}>{label}</button>)}
    </div>
    <div id={`ri-panel-${tab}`} role="tabpanel" aria-labelledby={`ri-tab-${tab}`}>
      {tab==='holdout' && <HoldoutPanel/>}
      {tab==='insample' && <InSamplePanel/>}
      {tab==='m5' && <M5Panel/>}
      {tab==='diagnostics' && <DiagnosticsPanel/>}
    </div>
    <footer className="ri-provenance">Data source: {research.provenance.source_csv} · Notebook: {research.provenance.notebook} · Saved results, not browser refits</footer>
  </section>;
}
