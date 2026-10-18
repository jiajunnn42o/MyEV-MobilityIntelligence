import { MarketSeasonalitySection, ForecastResearchSection } from './components/ResearchIntelligence.jsx';
import PolicyIntelligence from './components/PolicyIntelligence.jsx';
import ForecastIntelligence from './components/ForecastIntelligence.jsx';
import VolterraIcon from './components/VolterraIcon.jsx';
// MyEV-OVERVIEW-GEO-CLARITY-V7
import OverviewGeoSnapshot from './components/OverviewGeoSnapshot.jsx';
// MyEV V6 - VISUAL CLARITY
// MyEV DATA INTEGRATION V5
import { GeographicIntelligencePage, MarketBrandInsights } from './components/DataDrivenViews.jsx';
import InteractiveGeoMap from './components/InteractiveGeoMap.jsx';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import market from './data/market.json';
import mapdata from './data/map.json';

const M = market.monthly;
const F = market.forecast;
const last = M[M.length-1];
const lastYear = M.find(r => r.date === '2025-08');
const yY = lastYear ? (last.ev / lastYear.ev - 1)*100 : null;
const fmt = n => Math.round(n).toLocaleString('en-MY');
const pct = (n, d=2) => `${Number(n).toFixed(d)}%`;
const yearMonth = s => new Date(`${s}-01T00:00:00`).toLocaleDateString('en-GB', {month:'short',year:'numeric'});
const dateShort = s => new Date(`${s}-01T00:00:00`).toLocaleDateString('en-GB', {month:'short',year:'2-digit'});
const PC = {ev:'#b0ff28',hybrid:'#757a7a',petrol:'#bfc2bc',dark:'#171918',lime:'#aaff19'};

// Vuesax / Iconsax TwoTone, using the official web component library.
// See https://docs.iconsax.io/npm/web-component
const ICONSAX = {
  arrow:'arrow-right', up:'arrow-up', down:'arrow-down', moon:'moon', sun:'sun-1',
  download:'document-download', chart:'chart-2', map:'map', pin:'location', activity:'activity',
  layers:'layer', filter:'filter', file:'document-text', info:'info-circle', external:'export',
  check:'tick-circle', pause:'pause', close:'close-circle', menu:'hamberger-menu',
  search:'search-normal-1', grid:'element-4', spark:'magic-star', history:'refresh',
  database:'database', plug:'electricity', shield:'shield-tick', clock:'clock',
  leaf:'tree', compass:'discover', calendar:'calendar', more:'more'
};
// MyEV-ICON-RECOVERY-V9 — only the icon renderer was updated.
function Icon({ name, size = 18, className = '', ...props }) {
  return <VolterraIcon name={name} size={size} className={className} {...props} />;
}

function Brand({go}) {return <button className="brand" onClick={()=>go('overview')} aria-label="MyEV home"><span className="brand-mark"><span className="brand-mark-inner"/></span><span className="brand-type">MyEV<span className="brand-dot">.</span></span></button>}
const NAV=[{title:'Overview',to:'overview'}, {title:'Markets',to:'market'}, {title:'Geospatial',items:[['Geographic explorer','geographic'],['Charging network','charging']]}, {title:'Intelligence',items:[['Forecasting lab','forecasting'],['Policy explorer','policy'],['Scenario studio','scenarios']]}, {title:'Sustainability',to:'sustainability'}, {title:'Reports',to:'reports'}];
function App(){
 const [page,setPage]=useState((location.hash.replace('#/','')||'overview').split('?')[0]);
 const [theme,setTheme]=useState('light');
 const [drop,setDrop]=useState(null);
 const [mobile,setMobile]=useState(false);
 const [showSearch,setShowSearch]=useState(false);
 const [notice,setNotice]=useState('');
 useEffect(()=>{const fn=()=>{setPage(location.hash.replace('#/','')||'overview');setDrop(null);setMobile(false);window.scrollTo({top:0,behavior:'smooth'})};addEventListener('hashchange',fn);return()=>removeEventListener('hashchange',fn)},[]);

 // MyEV-MAP-MOTION-V3 — animate visible sections once per page; reduced-motion safe.
 useEffect(() => {
   const root = document.querySelector('.main-content');
   if (!root || typeof IntersectionObserver === 'undefined' ||
       window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
   const targets = [...root.querySelectorAll(
     '.kpi-strip .metric, .inner-kpis .metric, .analysis-grid > .panel, .feature-grid > .feature-card, .module-section > .section-header, .geo-bottom-cards > .info-card'
   )];
   const observer = new IntersectionObserver(entries => {
     entries.forEach(entry => {
       if (!entry.isIntersecting) return;
       entry.target.classList.add('vm-visible');
       observer.unobserve(entry.target);
     });
   }, { threshold: 0.06, rootMargin: '0px 0px -12px 0px' });
   targets.forEach(element => { element.classList.add('vm-reveal'); observer.observe(element); });
   return () => { observer.disconnect(); targets.forEach(element => element.classList.remove('vm-reveal', 'vm-visible')); };
 }, [page]);
 const go=p=>{if(location.hash===`#/${p}`){setPage(p);window.scrollTo({top:0,behavior:'smooth'})}else location.hash=`/${p}`;setDrop(null);setMobile(false);setShowSearch(false)};
 const notify=msg=>{setNotice(msg);setTimeout(()=>setNotice(''),4200)};
 const download=()=>{const cols=['date','total','ev','hybrid','petrol','evShare','hybridShare','electrifiedShare','evOfElectrified'];const csv=[cols.join(','),...M.map(r=>cols.map(c=>r[c]).join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='myev_jpj_car_market_2022_2026.csv';a.click();URL.revokeObjectURL(a.href);};
 const pages={overview:'Overview',market:'Market intelligence',geographic:'Geographic explorer',charging:'Charging infrastructure',forecasting:'Forecasting lab',policy:'Policy intelligence',scenarios:'Scenario simulator',sustainability:'Sustainability intelligence',reports:'Reports & insights'};
 return <div className={`app theme-${theme}`}>
  <header className="site-header">
   <div className="header-inner">
    <Brand go={go}/>
    <nav className="nav-main" aria-label="Main navigation">{NAV.map(n=>n.to?<button key={n.title} className={`nav-item ${page===n.to?'active':''}`} onClick={()=>go(n.to)}>{n.title}</button>:<div className="nav-wrap" key={n.title}><button className={`nav-item ${n.items.some(x=>x[1]===page)?'active':''}`} onClick={()=>setDrop(drop===n.title?null:n.title)}>{n.title}<Icon name="down" size={13}/></button>{drop===n.title&&<div className="nav-menu">{n.items.map(([label,id])=><button key={id} onClick={()=>go(id)}><span>{label}</span><Icon name="up" size={14}/></button>)}</div>}</div>)}</nav>
    <div className="nav-actions"><span className="live-data"><i/> JPJ DATA · AUG '26</span><button className="icon-btn" aria-label="Search navigation" onClick={()=>setShowSearch(true)}><Icon name="search" size={18}/></button><button className="icon-btn" aria-label="Toggle dark mode" onClick={()=>setTheme(theme==='light'?'dark':'light')}><Icon name={theme==='light'?'moon':'sun'} size={18}/></button><button className="header-export" onClick={download}><Icon name="download" size={15}/> Export data</button><button className="mobile-toggle icon-btn" aria-label="Open navigation" onClick={()=>setMobile(!mobile)}><Icon name={mobile?'close':'menu'}/></button></div>
   </div>
   {mobile&&<div className="mobile-nav">{NAV.flatMap(n=>n.to?[[n.title,n.to]]:n.items).map(([n,id])=><button key={id} onClick={()=>go(id)}>{n}<Icon name="arrow" size={15}/></button>)}</div>}
  </header>
  <main className="main-content" key={page}>
  {page==='overview'&&<Overview go={go} download={download}/>}
  {page==='market'&&<><MarketPage go={go}/><><MarketBrandInsights/><MarketSeasonalitySection/></></>}
  {page==='geographic'&&<GeographicIntelligencePage/>}
  {page==='charging'&&<ChargingPage go={go}/>}
  {page==='forecasting'&&<><ForecastIntelligence/><ForecastResearchSection/></>}
  {page==='policy'&&<PolicyIntelligence go={go}/>}
  {page==='scenarios'&&<ScenarioPage go={go}/>}
  {page==='sustainability'&&<SustainPage go={go}/>}
  {page==='reports'&&<ReportsPage download={download} go={go}/>}
  </main>
  <footer className="footer"><div className="footer-left"><span className="footer-brand">MyEV<span className="brand-dot">.</span></span><span>Malaysia Electric Mobility Intelligence</span></div><div className="footer-right"><span>Data: JPJ / data.gov.my · Through Aug 2026</span><span>Independent research prototype · Not an official JPJ service</span></div></footer>
  {notice&&<div className="toast"><Icon name="info"/>{notice}</div>}
  {showSearch&&<div className="search-scrim" onClick={()=>setShowSearch(false)}><div className="search-dialog" onClick={e=>e.stopPropagation()}><div className="search-head"><Icon name="search"/><input autoFocus placeholder="Find a page..." onKeyDown={e=>{if(e.key==='Escape')setShowSearch(false)}} onChange={e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('.search-result').forEach(el=>{el.style.display=el.dataset.name.includes(q)?'flex':'none'})}}/><button className="icon-btn" onClick={()=>setShowSearch(false)}><Icon name="close"/></button></div>{Object.entries(pages).map(([id,name])=><button key={id} className="search-result" data-name={name.toLowerCase()} onClick={()=>go(id)}><span>{name}</span><Icon name="arrow" size={15}/></button>)}</div></div>}
 </div>
}
function Kicker({children}) {return <div className="kicker"><span className="kicker-mark"/>{children}</div>}
function SectionHeader({eyebrow,title,desc,action,click}) {return <div className="section-header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{desc&&<p>{desc}</p>}</div>{action&&<button className="text-link" onClick={click}>{action}<Icon name="up" size={15}/></button>}</div>}
function DataTag({children,icon='database'}) {return <span className="data-tag"><Icon name={icon} size={13}/>{children}</span>}
function Metric({num,label,sub,accent=false}){return <div className="metric"><span className="metric-label">{label}</span><div className={`metric-num ${accent?'metric-accent':''}`}>{num}</div><div className="metric-sub">{sub}</div></div>}
// MyEV-MAP-MOTION-V3 — shared interactive preview; original Iconsax and nav remain unchanged.
function HomeGeoPreview() {
  const [selected, setSelected] = useState('Kuala Lumpur');
  return <InteractiveGeoMap compact selected={selected} onSelect={setSelected} />;
}
function Overview({go,download}){
 return <div className="page page-overview">
  <section className="hero"><div className="hero-copy"><Kicker>MALAYSIA · MOBILITY INTELLIGENCE</Kicker><h1>The transition<br/><span>in motion</span><span className="hero-punct">.</span></h1><p>A clearer view of Malaysia's shift to electric mobility. Explore the market, understand the policy, and anticipate what comes next.</p><div className="hero-actions"><button className="button-dark" onClick={()=>go('market')}>Explore the market <Icon name="up" size={17}/></button><button className="button-ghost" onClick={()=>document.getElementById('geo-preview')?.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'})}>Explore the map <Icon name="arrow" size={18}/></button></div></div><div className="hero-stamp"><span>INSIGHT EDITION</span><strong>26<span>/</span>08</strong><span>BASED ON OFFICIAL JPJ RECORDS</span></div></section>
  <div className="meta-ribbon"><span><span className="ribbon-dot"/> Data coverage <strong>Jan 2000 – Aug 2026</strong></span><span><Icon name="check" size={14}/> Computed from the uploaded JPJ CSV</span><span className="ribbon-end">Updated from uploaded source <Icon name="up" size={14}/></span></div>
  <section className="kpi-strip"><Metric label="EV REGISTRATIONS" num={fmt(last.ev)} sub={<><span className="positive">↗ +{yY.toFixed(1)}% YoY</span> · Aug 2026</>}/><Metric label="HYBRID REGISTRATIONS" num={fmt(last.hybrid)} sub="Passenger cars · Aug 2026"/><Metric label="EV MARKET SHARE" num={pct(last.evShare)} sub="EV / all car registrations"/><Metric label="TOTAL ELECTRIFICATION" num={pct(last.electrifiedShare)} sub="EV + Hybrid / all cars" accent/></section>
  <section className="analysis-grid" id="geo-preview"><div className="panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">01 / MARKET SIGNAL</span><h3>Adoption, in perspective<span className="dot-lime">.</span></h3><p>Compare EV and hybrid registrations to see how market demand is changing. Jan 2022 – Aug 2026.</p></div><DataTag>JPJ OPEN DATA</DataTag></div><MarketChart/>
    <div className="market-chart-insight">
      <span className="market-insight-indicator" aria-hidden="true" />
      <span>
        <strong>{last.ev > last.hybrid ? 'EV registrations lead hybrid this month.' : 'EV and hybrid registrations continue to evolve.'}</strong>
        {' '}In {yearMonth(last.date)}, EVs represented {pct(last.evShare)} of all new passenger-car registrations.
      </span>
    </div><div className="panel-foot"><span><span className="data-led lime"/>Electric</span><span><span className="data-led slate"/>Hybrid</span><span className="panel-foot-right">Source: JPJ · registrations by fuel</span></div></div><div className="panel map-panel"><div className="panel-heading"><div><span className="eyebrow">02 / GEOGRAPHIC LENS</span><h3>Across Malaysia<span className="dot-lime">.</span></h3><p>Compare state-linked EV registrations in 2026, with the data coverage clearly explained.</p></div></div><OverviewGeoSnapshot /><div className="map-bottom"><div><span className="map-legend-dot"/> <span className="map-footer-copy"><strong>Known-state registration data</strong><small>Reported state records, not EV ownership</small></span></div><button onClick={()=>go('geographic')} className="map-footer-link">View state breakdown <Icon name="arrow" size={15}/></button></div></div></section>
  <section className="module-section"><SectionHeader eyebrow="A CLOSER LOOK" title="The intelligence behind the shift." desc="Every signal tells a different part of the story." action="View all modules" click={()=>go('market')}/><div className="feature-grid"><div className="feature-card forecast-feature"><div className="feature-top"><span className="eyebrow">03 / FORWARD VIEW</span><span className="pill-dark">M9 · RESEARCH MODEL</span></div><div className="forecast-number">{F[F.length-1].value.toFixed(2)}<small>%</small></div><p className="forecast-desc">Projected EV share within EV + Hybrid by Dec 2030.</p><div className="mini-forecast"><ForecastSpark/></div><div className="feature-bottom"><span>95% conditional PI: {pct(F[F.length-1].lower)} – {pct(F[F.length-1].upper)}</span><button className="round-arrow" onClick={()=>go('forecasting')} aria-label="Open forecasts"><Icon name="up"/></button></div></div><div className="feature-card mix-feature"><div className="feature-top"><span className="eyebrow">04 / FUEL COMPOSITION</span><span className="year-pill">AUG 2026</span></div><h3>A shifting<br/>powertrain mix.</h3><div className="mix-visual"><DonutChart/><div className="mix-legend"><div><i className="small-square green"/><span>Electric</span><b>{pct(last.evShare,1)}</b></div><div><i className="small-square mid"/><span>Hybrid</span><b>{pct(last.hybridShare,1)}</b></div><div><i className="small-square grey"/><span>All others</span><b>{pct(100-last.electrifiedShare,1)}</b></div></div></div><div className="feature-bottom"><span>Share of passenger car registrations</span><button className="round-arrow" onClick={()=>go('market')} aria-label="Open market"><Icon name="up"/></button></div></div><div className="feature-card policy-feature"><div className="feature-top"><span className="eyebrow">05 / POLICY CONTEXT</span><span className="year-pill">EVENT STUDY</span></div><h3>Numbers don't<br/>move alone.</h3><div className="policy-list"><div><i className="event-dot"/><div><b>JAN 2022</b><span>Budget 2022 EV incentives begin</span></div></div><div><i className="event-dot active"/><div><b>DEC 2025</b><span>CBU EV duty exemption expires</span></div></div><div><i className="event-dot"/><div><b>2026</b><span>Post-exemption regime evaluation</span></div></div></div><div className="feature-bottom"><span>Associations ≠ causal attribution</span><button className="round-arrow" onClick={()=>go('policy')} aria-label="Open policy"><Icon name="up"/></button></div></div></div></section>
  <div className="closing-banner"><div><span className="eyebrow">BUILT FOR BETTER DECISIONS</span><h2>Go beyond the chart<span>.</span></h2><p>Explore market signals, forecasting uncertainty, policy context and the path to a more sustainable mobility future.</p></div><button className="banner-btn" onClick={()=>go('forecasting')}>Launch intelligence lab <Icon name="up" size={17}/></button></div>
 </div>;
}
function formatY(v,mode){return mode==='share'?`${v.toFixed(0)}%`:v>=1000?`${(v/1000).toFixed(0)}k`:v.toFixed(0)}
function linePath(points){return points.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')}
// The overview chart measures its own rendered size so SVG labels retain their
// natural pixel size. It grows vertically with the adjacent map card without
// stretching or flattening the axes. The wide Market-page version is unchanged.
function MarketChart({ wide = false, baseMode = 'registrations', all = false }) {
  const [mode, setMode] = useState(baseMode);
  const [range, setRange] = useState(wide ? 'ALL' : '3Y');
  const [active, setActive] = useState(null);
  const chartRef = useRef(null);
  const [size, setSize] = useState({ width: 900, height: wide ? 300 : 410 });

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;

    const resize = () => {
      const rectangle = element.getBoundingClientRect();
      const width = Math.max(280, Math.round(rectangle.width));
      const height = Math.max(190, Math.round(rectangle.height));
      setSize((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height }
      );
    };

    resize();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [wide]);

  const data = useMemo(() => {
    if (range === '1Y') return M.slice(-12);
    if (range === '3Y') return M.slice(-36);
    return M;
  }, [range]);

  const dataKeys = {
    registrations: { ev: 'ev', hybrid: 'hybrid' },
    share: { ev: 'evShare', hybrid: 'hybridShare' }
  };
  const fields = dataKeys[mode];
  const maxValue = Math.max(...data.map((row) =>
    Math.max(row[fields.ev], row[fields.hybrid])
  ));
  const step = mode === 'share' ? 2 : 2000;
  const yMax = Math.max(step, Math.ceil(maxValue * 1.12 / step) * step);

  const { width, height } = size;
  const bounds = {
    left: width < 480 ? 43 : 53,
    right: width - 19,
    top: 25,
    bottom: height - 44
  };
  const xFor = (index) => bounds.left +
    (bounds.right - bounds.left) * index / Math.max(1, data.length - 1);
  const yFor = (value) => bounds.bottom -
    value / yMax * (bounds.bottom - bounds.top);
  const activeIndex = active === null
    ? data.length - 1
    : Math.min(active, data.length - 1);
  const shown = data[activeIndex];

  const tickCount = width < 420 ? 3 : width < 650 ? 4 : 6;
  const tickIndices = [...new Set(
    Array.from({ length: tickCount }, (_, i) =>
      Math.round(i * (data.length - 1) / (tickCount - 1))
    )
  )];

  const chartPath = (key) => linePath(
    data.map((row, i) => [xFor(i), yFor(row[fields[key]])])
  );

  return (
    <div className={`viz-wrap ${wide ? 'viz-wide' : ''}`}>
      <div className="chart-controls">
        <div className="toggle-group">
          <button
            type="button"
            className={mode === 'registrations' ? 'picked' : ''}
            onClick={() => { setMode('registrations'); setActive(null); }}
          >
            Volume
          </button>
          <button
            type="button"
            className={mode === 'share' ? 'picked' : ''}
            onClick={() => { setMode('share'); setActive(null); }}
          >
            Market share
          </button>
        </div>
        <div className="range-group">
          {['1Y', '3Y', 'ALL'].map((value) => (
            <button
              type="button"
              key={value}
              className={range === value ? 'picked' : ''}
              onClick={() => { setRange(value); setActive(null); }}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="linechart-container" ref={chartRef}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Monthly electric and hybrid car registrations"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
            <g key={fraction}>
              <line
                x1={bounds.left}
                x2={bounds.right}
                y1={yFor(yMax * fraction)}
                y2={yFor(yMax * fraction)}
                className="chart-grid"
              />
              <text
                x={bounds.left - 10}
                y={yFor(yMax * fraction) + 4}
                textAnchor="end"
                className="axis-label"
              >
                {formatY(yMax * fraction, mode)}
              </text>
            </g>
          ))}

          {tickIndices.map((index, position) => (
            <text
              key={data[index].date}
              className="axis-label"
              x={xFor(index)}
              y={height - 13}
              textAnchor={position === 0 ? 'start' :
                position === tickIndices.length - 1 ? 'end' : 'middle'}
            >
              {dateShort(data[index].date)}
            </text>
          ))}

          {['ev', 'hybrid'].map((key) => (
            <path
              key={key}
              className={`plot-line plot-${key}`}
              d={chartPath(key)}
              fill="none"
              stroke={key === 'ev' ? '#A9FF19' : '#737A78'}
              strokeWidth={key === 'ev' ? 3 : 2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <line
            x1={xFor(activeIndex)}
            x2={xFor(activeIndex)}
            y1={bounds.top}
            y2={bounds.bottom}
            stroke="currentColor"
            opacity=".18"
            strokeDasharray="4 5"
          />

          {['ev', 'hybrid'].map((key) => (
            <circle
              key={key}
              cx={xFor(activeIndex)}
              cy={yFor(shown[fields[key]])}
              r="4.8"
              fill={key === 'ev' ? '#A9FF19' : '#737A78'}
              stroke="var(--card)"
              strokeWidth="2.5"
            />
          ))}

          <rect
            x={bounds.left}
            y={bounds.top}
            width={bounds.right - bounds.left}
            height={bounds.bottom - bounds.top}
            fill="transparent"
            onPointerMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const ratio = (event.clientX - rect.left) / rect.width;
              const index = Math.round(ratio * (data.length - 1));
              setActive(Math.max(0, Math.min(data.length - 1, index)));
            }}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
        <div className="chart-tooltip" aria-live="off">
          <span>{yearMonth(shown.date)}</span>
          <b><i className="small-square green" /> EV {mode === 'share' ? pct(shown.evShare, 2) : fmt(shown.ev)}</b>
          <b><i className="small-square mid" /> Hybrid {mode === 'share' ? pct(shown.hybridShare, 2) : fmt(shown.hybrid)}</b>
        </div>
      </div>
    </div>
  );
}

function DonutChart(){let parts=[last.evShare,last.hybridShare,100-last.electrifiedShare];let offset=0;return <div className="donut-wrap"><svg viewBox="0 0 170 170"><circle cx="85" cy="85" r="64" fill="none" stroke="var(--soft)" strokeWidth="20"/>{parts.map((p,i)=>{let start=offset;offset+=p;return <circle key={i} cx="85" cy="85" r="64" fill="none" stroke={['#a9f820','#747a79','#dfe0dc'][i]} strokeWidth="20" strokeDasharray={`${p/100*402.12} ${402.12-p/100*402.12}`} strokeDashoffset={-start/100*402.12} transform="rotate(-90 85 85)"/>})}<text x="85" y="77" textAnchor="middle" fontSize="13" className="donut-label">xEV SHARE</text><text x="85" y="103" textAnchor="middle" fontSize="26" fontWeight="600" className="donut-num">{last.electrifiedShare.toFixed(1)}%</text></svg></div>}
function ForecastSpark(){const w=330,h=82;const dates=F.filter((_,i)=>i%3===0);const v=dates.map((d,i)=>[4+i/(dates.length-1)*321,70-(d.value-45)/40*60]);return <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-label="Forecast trend preview"><path d={linePath(v)+' L325,78 L4,78Z'} fill="#aeff28" opacity=".12"/><path d={linePath(v)} stroke="#aeff28" strokeWidth="2.5" fill="none"/><line x1="4" x2="326" y1="77" y2="77" stroke="#454a44"/></svg>}
function MalaysiaMap({compact=false,selected,select}){
 const [internal,setInternal]=useState('Kuala Lumpur');
 const [zoom,setZoom]=useState(1);
 const current=selected||internal;
 const set=select||setInternal;
 const chosen=mapdata.markers.find(p=>p.name===current)||mapdata.markers[0];
 const handleWheel=e=>{if(e.ctrlKey){e.preventDefault();setZoom(z=>Math.max(1,Math.min(2.4,z+(e.deltaY<0?.12:-.12))))}};
 return <div className={`malaysia-map ${compact?'compact':''}`} onWheel={handleWheel}>
  <div className="geo-map-topbar"><span className="geo-map-eyebrow"><span className="geo-map-live"/> MALAYSIA / GEOGRAPHIC BASEMAP</span><span className="geo-map-topright">REFERENCE LOCATIONS <span>·</span> 05</span></div>
  <svg className="malaysia-map-art" viewBox="0 0 685 320" role="img" aria-label="Outlined geography of West and East Malaysia with clickable city reference pins">
   <defs>
    <pattern id="mapFineGrid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0 H0 V22" stroke="currentColor" strokeWidth=".35" fill="none" opacity=".22"/></pattern>
    <pattern id="mapLandTexture" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".55" fill="currentColor" opacity=".09"/></pattern>
    <linearGradient id="mapLandFill" x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#ebeee9"/><stop offset="1" stopColor="#cdd4ce"/></linearGradient>
    <filter id="countryAmbient" x="-20%" width="140%" y="-20%" height="140%"><feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#7c887a" floodOpacity=".10"/></filter>
   </defs>
   <rect width="685" height="320" fill="url(#mapFineGrid)" className="map-grid-background"/>
   <g transform={`translate(${342.5*(1-zoom)} ${160*(1-zoom)}) scale(${zoom})`} style={{transition:'transform .35s ease'}}>
    <path d="M0 80H685 M0 180H685 M130 0V320 M355 0V320 M550 0V320" stroke="currentColor" strokeWidth=".6" strokeDasharray="2 7" opacity=".15"/>
    <g filter="url(#countryAmbient)">{mapdata.paths.west.map((p,i)=><path key={'west'+i} d={p} className="map-country"/>)}{mapdata.paths.east.map((p,i)=><path key={'east'+i} d={p} className="map-country"/>)}</g>
    <g style={{pointerEvents:'none'}}>{mapdata.paths.west.concat(mapdata.paths.east).map((p,i)=><path key={'texture'+i} d={p} fill="url(#mapLandTexture)" opacity=".55"/>)}</g>
    <text className="map-region" x="80" y="36">PENINSULAR</text><text className="map-region" x="439" y="36">BORNEO</text>
    {mapdata.markers.map(p=><g key={p.name} className="map-marker" role="button" tabIndex={0} onClick={()=>set(p.name)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();set(p.name)}}} aria-label={`Select ${p.name}`}>
       {current===p.name&&<circle cx={p.x} cy={p.y} r="14" className="marker-glow"/>}
       <circle cx={p.x} cy={p.y} r={current===p.name?7:5.3} className={current===p.name?'marker-active':'marker-idle'}/>
       <circle cx={p.x} cy={p.y} r="1.8" fill={current===p.name?'#171918':'#fcfdfb'}/>
       <text x={p.x+12} y={p.y-9} className={current===p.name?'marker-label active':'marker-label'}>{p.name}</text>
     </g>)}
   </g>
  </svg>
  <div className="geo-map-city-card"><div className="geo-map-city-icon"><Icon name="pin" size={18}/></div><div><span>LOCATION FOCUS</span><b>{chosen.name}</b><small>Reference marker · no state adoption data</small></div></div>
  <div className="geo-map-controls"><button aria-label="Zoom in map" title="Zoom in" onClick={()=>setZoom(z=>Math.min(2.4,z+.3))}><span>+</span></button><button aria-label="Zoom out map" title="Zoom out" onClick={()=>setZoom(z=>Math.max(1,z-.3))}><span>−</span></button><button aria-label="Reset map zoom" title="Fit to Malaysia" onClick={()=>setZoom(1)}><Icon name="grid" size={16}/></button></div>
  <div className="map-disclaimer"><Icon name="info" size={13}/><span>Map preview uses real national outlines and reference cities, not regional EV statistics.</span></div>
 </div>
}

function PageHero({kicker,title,desc,right}) {return <div className="page-title-area"><div><Kicker>{kicker}</Kicker><h1>{title}<span className="hero-punct">.</span></h1><p>{desc}</p></div>{right&&<div className="page-hero-aside">{right}</div>}</div>}
function MarketPage({go}){const [show,setShow]=useState('monthly');const prev=M[M.length-2];const last12=M.slice(-12);return <div className="page inner-page"><PageHero kicker="01 / MARKET INTELLIGENCE" title="A market in transition" desc="Understand how newly registered cars in Malaysia shift between EV, hybrid and other fuel types. Compare counts, market share, seasonality and the brands behind 2026 registrations." right={<DataTag>56 MONTHS · MODEL WINDOW</DataTag>}/><div className="inner-kpis"><Metric label="AUG 2026 CAR REGISTRATIONS" num={fmt(last.total)} sub="All passenger car fuel types"/><Metric label="ELECTRIC VEHICLES" num={fmt(last.ev)} sub={`${pct(last.evShare)} of total market`}/><Metric label="HYBRID VEHICLES" num={fmt(last.hybrid)} sub={`${pct(last.hybridShare)} of total market`}/><Metric label="EV MOMENTUM" num={`+${yY.toFixed(1)}%`} sub="Year on year · Aug 2025 to Aug 2026" accent/></div><div className="panel wide-panel"><div className="panel-heading"><div><span className="eyebrow">ADOPTION TRAJECTORY</span><h3>EV and hybrid registrations.</h3><p>Switch between vehicles registered per month and the percentage of all passenger-car registrations. Compare 1-year, 3-year and full-history views.</p></div><DataTag>OFFICIAL REGISTRATIONS</DataTag></div><MarketChart wide/>
    <div className="market-reading-grid">
      <div className="market-reading-item">
        <span>01 / VOLUME</span>
        <strong>How many new registrations?</strong>
        <p>Monthly vehicle counts show scale. They are not vehicle sales or the number currently on the road.</p>
      </div>
      <div className="market-reading-item">
        <span>02 / MARKET SHARE</span>
        <strong>How large is each category?</strong>
        <p>EV share uses all passenger-car registrations as its denominator; the combined electrification share includes hybrid.</p>
      </div>
      <div className="market-reading-item">
        <span>03 / CONTEXT</span>
        <strong>What explains the movement?</strong>
        <p>Use the seasonal view, brand rankings and Policy Intelligence to investigate patterns. Association is not causation.</p>
      </div>
    </div></div><div className="market-lower"><div className="panel market-composition"><div className="panel-heading"><div><span className="eyebrow">ENERGY MIX</span><h3>Powertrain composition.</h3><p>How August 2026 registrations are split by fuel category, measured against all new passenger cars.</p></div></div><div className="big-mix"><DonutChart/><div className="mix-list"><div><span><i className="small-square green"/>Electric</span><strong>{fmt(last.ev)} <em>{pct(last.evShare,1)}</em></strong></div><div><span><i className="small-square mid"/>Hybrid</span><strong>{fmt(last.hybrid)} <em>{pct(last.hybridShare,1)}</em></strong></div><div><span><i className="small-square grey"/>Other fuels</span><strong>{fmt(last.total-last.ev-last.hybrid)} <em>{pct(100-last.electrifiedShare,1)}</em></strong></div></div></div></div><div className="panel market-heat"><div className="panel-heading"><div><span className="eyebrow">SEASONAL PROFILE</span><h3>EV registrations by month.</h3><p>A 2025 month-by-month view; compare intensity rather than assuming the pattern will repeat every year.</p></div></div><Heatmap/></div></div><div className="panel table-panel"><div className="panel-heading"><div><span className="eyebrow">SOURCE TRANSPARENCY</span><h3>Latest monthly observations.</h3><p>Counts are new registrations, not active vehicle stock or car sales.</p></div></div><table><thead><tr><th>Month</th><th>All cars</th><th>Electric</th><th>Hybrid</th><th>EV share</th><th>Electrified share</th></tr></thead><tbody>{M.slice(-8).reverse().map(r=><tr key={r.date}><td>{yearMonth(r.date)}</td><td>{fmt(r.total)}</td><td>{fmt(r.ev)}</td><td>{fmt(r.hybrid)}</td><td><span className="table-chip">{pct(r.evShare)}</span></td><td>{pct(r.electrifiedShare)}</td></tr>)}</tbody></table></div></div>}
function Heatmap(){const arr=M.filter(r=>r.date.startsWith('2025-'));const m=Math.max(...arr.map(x=>x.ev));return <div className="heatmap"><div className="heat-months">{arr.map(r=><div key={r.date} className="heat-col"><span>{r.date.split('-')[1]}</span><div className="heat-cell" style={{background:`rgba(151,232,21,${0.12+0.88*r.ev/m})`}} title={`${yearMonth(r.date)}: ${fmt(r.ev)} EVs`}/><small>{(r.ev/1000).toFixed(1)}k</small></div>)}</div><div className="heat-legend">2025 monthly electric car registrations <span>LOW <i/> <i/> <i/> <i/> HIGH</span></div></div>}
function GeographicPage({go,notify}){const [city,setCity]=useState('Kuala Lumpur');return <div className="page inner-page"><PageHero kicker="02 / GEOGRAPHIC INTELLIGENCE" title="A different view of Malaysia" desc="A spatial canvas for the electric transition. Today: national geography. Next: state-level adoption and charging availability." right={<DataTag icon="map">GEOSPATIAL PREVIEW</DataTag>}/><div className="geo-layout"><div className="panel geo-main"><div className="panel-heading"><div><span className="eyebrow">INTERACTIVE ATLAS</span><h3>Malaysia, from a geographic lens.</h3><p>Pan, zoom and select real state boundaries or five reference locations.</p></div><span className="outline-chip">OSM / MALAYSIA FOCUS</span></div><InteractiveGeoMap selected={city} onSelect={setCity}/><div className="geo-tools"><span><span className="map-legend-dot"/> Selected location: <strong>{city}</strong></span><span>Not a state-level adoption heatmap</span></div></div><div className="panel geo-detail"><div className="detail-top"><span className="eyebrow">LOCATION FOCUS</span><Icon name="compass"/></div><h2>{city}</h2><p>Selected state or geographic reference location.</p><div className="placeholder-stat"><span>STATE EV MARKET SHARE</span><strong>Awaiting<br/>state dataset</strong><small>No fabricated regional metrics.</small></div><h4>Coming with state registration data</h4><ul className="tick-list"><li><Icon name="check" size={15}/> State adoption choropleth</li><li><Icon name="check" size={15}/> Year slider and regional ranking</li><li><Icon name="check" size={15}/> State comparison and drill-down</li></ul><button className="button-dark wide" onClick={()=>notify('Regional EV metrics need JPJ state-level transaction data. National figures remain accessible in Markets.')}>About data coverage <Icon name="info" size={17}/></button></div></div><div className="geo-bottom-cards"><div className="info-card"><Icon name="database" size={21}/><h3>National data connected</h3><p>Monthly car registrations by fuel through Aug 2026. No states are coded in the current CSV.</p></div><div className="info-card"><Icon name="map" size={21}/><h3>Real outlines, no fake numbers</h3><p>Both the Overview and Geographic Explorer use interactive maps with official state boundaries when loaded.</p></div><div className="info-card"><Icon name="layers" size={21}/><h3>Next data integration</h3><p>JPJ state registration transactions + DOSM state boundaries for the final choropleth layer.</p></div></div></div>}
function ForecastGraph(){const dates=[...M.map(r=>({date:r.date,value:r.evOfElectrified,observed:true})),...F.map(r=>({...r,observed:false}))];const w=1100,h=345,left=44,right=1065,top=15,bottom=300;const xx=i=>left+(right-left)*i/(dates.length-1),yy=v=>bottom-v/100*(bottom-top);const hist=dates.filter(r=>r.observed),pred=dates.filter(r=>!r.observed);const offset=hist.length-1;const futurePts=pred.map((r,i)=>[xx(i+hist.length),yy(r.value)]);const upper=pred.map((r,i)=>[xx(i+hist.length),yy(r.upper)]);const lower=pred.map((r,i)=>[xx(i+hist.length),yy(r.lower)]).reverse();return <div className="forecast-viz"><svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Observed EV share of EV and hybrid cars and M9 forecast with conditional prediction interval">{[0,25,50,75,100].map(v=><g key={v}><line x1={left} x2={right} y1={yy(v)} y2={yy(v)} className="chart-grid"/><text className="axis-label" textAnchor="end" x={left-10} y={yy(v)+4}>{v}%</text></g>)}<path d={linePath(upper)+' '+linePath(lower).replace(/^M/,'L')+'Z'} fill="#acfb28" opacity=".16"/><path d={linePath(hist.map((r,i)=>[xx(i),yy(r.value)]))} fill="none" stroke="var(--maintext)" strokeWidth="2.6"/><path d={linePath([[xx(hist.length-1),yy(hist[hist.length-1].value)],...futurePts])} fill="none" stroke="#9dec14" strokeWidth="3"/><line x1={xx(hist.length-1)} x2={xx(hist.length-1)} y1={top} y2={bottom} stroke="var(--muted)" strokeDasharray="4 6"/><text className="axis-label" x={xx(hist.length-1)+7} y="27">FORECAST START</text>{['2022-01','2024-01','2026-01','2028-01','2030-01'].map(str=>{const i=dates.findIndex(x=>x.date===str);return i<0?null:<text key={str} className="axis-label" x={xx(i)} y="332" textAnchor="middle">{str.slice(0,4)}</text>})}</svg></div>}
function ForecastPage({go}){const final=F[F.length-1];return <div className="page inner-page"><PageHero kicker="03 / PREDICTIVE INTELLIGENCE" title="Anticipating the next move" desc="Explore a bounded logistic forecast with AR(1) residual structure, built from your Malaysia car-registration research." right={<DataTag icon="activity">M9 MODEL · CONDITIONAL OUTLOOK</DataTag>}/><div className="forecast-stats"><div className="forecast-main-stat"><span>DECEMBER 2030 · EV SHARE WITHIN ELECTRIFIED CARS</span><strong>{pct(final.value)}</strong><p>Conditional mean forecast · not share of all vehicles</p></div><div><span>95% CONDITIONAL INTERVAL</span><strong>{pct(final.lower)} – {pct(final.upper)}</strong><p>Excludes policy and parameter uncertainty</p></div><div><span>TRAINING WINDOW</span><strong>56 months</strong><p>Jan 2022 – Aug 2026</p></div></div><div className="panel wide-panel forecast-panel"><div className="panel-heading"><div><span className="eyebrow">MODEL OUTPUT / M9 LOGISTIC + AR(1)</span><h3>Observed adoption. Projected trajectory.</h3><p>EV as a percentage of combined EV + Hybrid registrations.</p></div><DataTag>RE-FITTED TO YOUR CSV</DataTag></div><ForecastGraph/><div className="panel-foot"><span><span className="data-led black"/>Observed</span><span><span className="data-led lime"/>Conditional forecast</span><span><span className="data-led band"/>95% prediction interval</span></div></div><div className="forecast-lower"><div className="panel basic-panel"><span className="eyebrow">MODEL TRANSPARENCY</span><h3>Why bounded growth?</h3><p>Logistic models constrain the long-run trend. This helps avoid implausible negative or greater-than-100% market shares that can arise from extrapolated polynomial trends.</p><p>However, a plausible bound does not guarantee superior hold-out accuracy. The estimated ceiling (59.13%) is even below the latest observed share (64.02%), which highlights long-horizon sensitivity. Confidence bands shown are conditional on the fitted parameters.</p></div><div className="panel basic-panel"><span className="eyebrow">WHAT THE FIGURES MEAN</span><div className="fact-row"><span>Historical share, Aug '26</span><b>{pct(last.evOfElectrified)}</b></div><div className="fact-row"><span>Long-run trend ceiling (K)</span><b>59.13%</b></div><div className="fact-row"><span>Prediction target</span><b>EV / (EV + Hybrid)</b></div><div className="fact-row"><span>Forecast latest month</span><b>Dec 2030</b></div></div></div></div>}
const EVENTS=[{date:'JAN 2014',name:'National Automotive Policy 2014',detail:'Historical context for hybrid vehicle incentives and the wider automotive sector.'},{date:'JUN–AUG 2018',name:'GST zero-rating window',detail:'A short vehicle-market tax holiday ahead of SST reintroduction.'},{date:'MAR 2020',name:'Movement Control Order',detail:'Pandemic disruption in the historical registration series.'},{date:'JAN 2022',name:'Budget 2022 EV incentives',detail:'Start of the accelerated EV adoption study period.'},{date:'DEC 2025',name:'CBU EV duty exemption ends',detail:'Event boundary used in the dissertation-style policy timeline.'},{date:'2026',name:'Post-exemption regime',detail:'An exploratory interrupted time series break; timing alone does not show causation.'}];
function PolicyPage({go}){const [selected,setSelected]=useState(4);return <div className="page inner-page"><PageHero kicker="04 / POLICY INTELLIGENCE" title="The context behind the curve" desc="Trace the milestones around Malaysian vehicle adoption. Visualize historical events without confusing correlation with causation." right={<DataTag icon="history">POLICY EVENT STUDY</DataTag>}/><div className="policy-hero-grid"><div className="panel policy-timeline"><div className="panel-heading"><div><span className="eyebrow">POLICY ARCHIVE</span><h3>Milestones that matter.</h3><p>Select an event to read the research context.</p></div></div><div className="timeline-items">{EVENTS.map((ev,i)=><button key={ev.date} className={`timeline-item ${selected===i?'selected':''}`} onClick={()=>setSelected(i)}><span className="timeline-bullet"/><span><small>{ev.date}</small><b>{ev.name}</b></span><Icon name="up" size={15}/></button>)}</div></div><div className="panel policy-selection"><span className="eyebrow">SELECTED EVENT / {String(selected+1).padStart(2,'0')}</span><span className="policy-year">{EVENTS[selected].date}</span><h2>{EVENTS[selected].name}</h2><p>{EVENTS[selected].detail}</p><div className="policy-caution"><Icon name="info" size={19}/><span>These event descriptions provide context. The registered trend before and after a policy event cannot independently demonstrate a causal policy effect.</span></div><button className="button-dark" onClick={()=>go('forecasting')}>Explore model forecasts <Icon name="up" size={16}/></button></div></div><div className="policy-info-grid"><div className="info-card"><Icon name="activity"/><h3>Interrupted Time Series</h3><p>The original assignment models a trend, intervention level shift, and potential post-event slope change.</p></div><div className="info-card"><Icon name="chart"/><h3>Reduced regression</h3><p>Significance-driven variable removal and refitting are documented in the associated Notebook.</p></div><div className="info-card"><Icon name="shield"/><h3>Research integrity</h3><p>Policy dates should be cited and exploratory event timing distinguished from verified effective dates.</p></div></div></div>}
function ChargingPage({go}){return <div className="page inner-page"><PageHero kicker="02B / INFRASTRUCTURE" title="Where the network grows" desc="The future spatial layer for EV charging infrastructure, capacity, availability and regional coverage." right={<span className="outline-chip">DATA CONNECTION PLANNED</span>}/><div className="connection-panel"><div className="connection-visual"><HomeGeoPreview/></div><div className="connection-copy"><span className="eyebrow">UPCOMING GEOSPATIAL LAYER</span><h2>Charging intelligence, built on evidence.</h2><p>This early design deliberately does not display fictional charging station pins or live availability. Station data must be sourced, deduplicated, licensed and timestamped before being published.</p><ul className="tick-list"><li><Icon name="check" size={15}/> AC / DC station locator</li><li><Icon name="check" size={15}/> Operator and connector filters</li><li><Icon name="check" size={15}/> Spatial coverage and density maps</li><li><Icon name="check" size={15}/> Reported status / last update</li></ul><button className="button-dark" onClick={()=>go('geographic')}>View current map <Icon name="arrow" size={17}/></button></div></div></div>}
function ScenarioPage({go}){const [ceiling,setCeiling]=useState(85),[growth,setGrowth]=useState(8),[year,setYear]=useState(2030);const estimate=ceiling/(1+(ceiling/45-1)*Math.exp(-growth/100*12*(year-2026)));return <div className="page inner-page"><PageHero kicker="05 / SCENARIO STUDIO" title="Test a different tomorrow" desc="Adjust assumptions and see how a simplified bounded adoption model responds. This is an illustrative simulator—not the academic M9 forecast." right={<DataTag icon="spark">ILLUSTRATIVE ASSUMPTIONS</DataTag>}/><div className="scenario-layout"><div className="panel scenario-controls"><span className="eyebrow">01 / ASSUMPTIONS</span><h3>Model your scenario.</h3><label className="slider-label">Adoption ceiling <b>{ceiling}%</b></label><input type="range" min="75" max="100" step="5" value={ceiling} onChange={e=>setCeiling(+e.target.value)}/><label className="slider-label">Monthly growth parameter <b>{growth}%</b></label><input type="range" min="2" max="15" value={growth} onChange={e=>setGrowth(+e.target.value)}/><label className="slider-label">Forecast horizon <b>{year}</b></label><input type="range" min="2027" max="2035" step="1" value={year} onChange={e=>setYear(+e.target.value)}/><button className="button-ghost reset-btn" onClick={()=>{setCeiling(85);setGrowth(8);setYear(2030)}}>Reset assumptions <Icon name="history" size={16}/></button></div><div className="panel scenario-result"><span className="eyebrow">02 / SIMULATED OUTPUT</span><h3>{year} EV share within electrified cars</h3><strong>{pct(estimate,1)}</strong><div className="scenario-track"><span style={{width:`${estimate}%`}}/></div><p>Illustrative Logistic estimate starting from an assumed 45% baseline in 2026. No external policy or energy variables are included. Do not interpret this as a validated statistical forecast.</p><button className="text-link" onClick={()=>go('forecasting')}>Open validated research forecast <Icon name="up" size={15}/></button></div></div></div>}
function SustainPage({go}){return <div className="page inner-page"><PageHero kicker="06 / SUSTAINABILITY" title="Mobility meets responsibility" desc="Connecting market adoption data with sustainability research, without overstating emissions impact or official SDG progress." right={<DataTag icon="leaf">SDG-ALIGNED INDICATORS</DataTag>}/><div className="sdg-grid"><div className="sdg-card"><span className="sdg-num">07</span><span className="eyebrow">AFFORDABLE & CLEAN ENERGY</span><h2>Enabling cleaner mobility.</h2><p>Analyze changes in vehicle electrification, with future integration planned for electricity mix and charging energy demand.</p><div className="sdg-stat"><span>AUG 2026 ELECTRIFIED CAR SHARE</span><strong>{pct(last.electrifiedShare)}</strong></div><small>This market indicator is not the UN's official SDG 7 progress metric.</small></div><div className="sdg-card"><span className="sdg-num">13</span><span className="eyebrow">CLIMATE ACTION</span><h2>Quantify impact, not impressions.</h2><p>Meaningful CO₂ estimates will require annual mileage, vehicle energy use and power-grid emission factors—not registration counts alone.</p><div className="sdg-stat unavailable"><span>VERIFIED CO₂ AVOIDED</span><strong>Not calculated</strong></div><small>No fictional emission-savings claims.</small></div></div><div className="panel sdg-method"><div><Icon name="shield" size={23}/><h3>Built-in methodological transparency</h3><p>We distinguish measured registrations, statistically estimated EV-share forecasts and assumption-driven environmental scenarios. Every chart should expose its source, units and reference date.</p></div><button className="button-dark" onClick={()=>go('market')}>Explore measured data <Icon name="arrow"/></button></div></div>}
function ReportsPage({download,go}){return <div className="page inner-page"><PageHero kicker="07 / INSIGHTS & REPORTING" title="Take the insight with you" desc="A reporting workspace designed to help turn research into decisions, with traceable data and clear model assumptions." right={<DataTag icon="file">RESEARCH EDITION</DataTag>}/><div className="report-cards">{[['Market dataset','Verified JPJ car registrations, Jan 2022 – Aug 2026.','CSV','download'],['Forecasting brief','Academic model results, conditional outlook and limitations.','Coming soon','forecasting'],['Policy impact brief','Policy timeline and descriptive associations.','Coming soon','policy']].map(([name,desc,type,to])=><div className="report-card" key={name}><div className="report-icon"><Icon name="file" size={23}/></div><span className="eyebrow">{type.toUpperCase()}</span><h3>{name}</h3><p>{desc}</p><button onClick={to==='download'?download:()=>go(to)}>{type==='CSV'?'Download dataset':'Open module'} <Icon name="up" size={16}/></button></div>)}</div></div>}
export default App;
