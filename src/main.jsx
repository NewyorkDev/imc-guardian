import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createGuardianEngine } from './engine.js';
import { installWebMcp, toolDefinitions } from './webmcp.js';
import { airports, demoRoute, forecasts, observations } from './scenario.js';
import './styles.css';
import './live.css';
import './national.css';

const routeDots = [{ x: 16, y: 77, id: 'KTPF' }, { x: 47, y: 49, id: 'KCTY' }, { x: 79, y: 20, id: 'KTLH' }];
const categoryClass = value => value.toLowerCase();

function App() {
  const engine = useMemo(() => createGuardianEngine(), []);
  const [, redraw] = useState(0);
  const [nativeCount, setNativeCount] = useState(0);
  const [mode, setMode] = useState('scenario');
  const [liveContext, setLiveContext] = useState(null);
  const [liveError, setLiveError] = useState('');
  const [running, setRunning] = useState(false);
  const [watching, setWatching] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [decision, setDecision] = useState('');
  const state = engine.state;
  const invoke = (name, input = {}) => { try { engine.run(name, input); redraw(n => n + 1); } catch (error) { alert(error.message); } };
  const runAssessment = () => {
    setRunning(true);
    invoke('set_flight_context', demoRoute);
    invoke('check_airport_conditions', { airportIds: demoRoute.stations });
    invoke('check_route_advisories');
    invoke('assess_route_weather');
    invoke('find_safer_alternates');
    invoke('compare_route_options');
    window.setTimeout(() => {
      setRunning(false);
      document.querySelector('.assessment')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
  };
  const loadLiveContext = async () => {
    setLiveError('');
    try {
      const [awcResponse, appleResponse] = await Promise.all([
        fetch('/api/weather?type=metar&ids=KTPF,KCTY,KTLH&format=json'),
        fetch('/api/weatherkit?scope=us')
      ]);
      if (!awcResponse.ok || !appleResponse.ok) throw new Error(`AWC ${awcResponse.status} / WeatherKit ${appleResponse.status}`);
      const [awc, apple] = await Promise.all([awcResponse.json(), appleResponse.json()]);
      setLiveContext({ awcReports: Array.isArray(awc) ? awc.length : 0, appleAsOf: apple.samples?.[0]?.asOf || 'available', weatherSamples: apple.samples || [] });
      setMode('live');
    } catch (error) {
      setLiveError(error.message);
      setMode('scenario');
    }
  };
  const enableRouteWatch = async () => {
    setWatching(true);
    setAlertVisible(true);
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    if ('Notification' in window && Notification.permission === 'granted') new Notification('IMC Guardian demo alert', { body: 'KTLH ceiling trend worsened. Aviate first. Review the new evidence when workload permits.' });
  };
  useEffect(() => { installWebMcp(engine, () => redraw(n => n + 1)).then(setNativeCount); }, [engine]);
  const assessment = state.assessment;
  const alternates = state.events.findLast?.(event => event.name === 'find_safer_alternates')?.output.alternates || [];
  return <div className="app">
    <header><a className="brand" href="#top"><span className="shield">IG</span><span><b>IMC GUARDIAN</b><small>AVIATION DECISION SUPPORT</small></span></a><nav><a href="#route">Route</a><a href="#evidence">Weather evidence</a><a href="#decision">Decision room</a></nav><div className="status"><i /> {nativeCount || toolDefinitions.length} WebMCP tools ready</div></header>

    <main id="top">
      <section className="hero">
        <div className="hero-copy"><p className="eyebrow">THE WEATHER DECISION, MADE VISIBLE</p><h1>See the risk<br/><em>before the clouds.</em></h1><p className="lede">A pilot and an AI inspect the same route, evidence, limits, and alternatives. The system explains. The pilot decides.</p><div className="hero-actions"><button className="primary" onClick={runAssessment} disabled={running}>{running ? 'Checking 6 route signals...' : assessment ? 'Run route check again' : 'Run Tampa → Tallahassee demo'} <span>→</span></button><button className="ghost" onClick={loadLiveContext}>Check live sources</button></div>{assessment && <p className="run-success">Route check complete. Six WebMCP calls are ready below.</p>}{liveContext && <p className="live-note">Live: {liveContext.awcReports} AWC reports · Apple WeatherKit updated {liveContext.appleAsOf}</p>}{liveError && <p className="live-error">Live connection unavailable: {liveError}. Reproducible scenario remains active.</p>}<p className="boundary">Decision support only. Not an official briefing, flight clearance, or go/no-go determination.</p></div>
        <div className="radar-card"><div className="radar-head"><span>ROUTE WEATHER PICTURE</span><b>{mode === 'scenario' ? 'REPRODUCIBLE SCENARIO' : 'LIVE AWC'}</b></div><div className="map"><div className="weather weather-one"/><div className="weather weather-two"/><svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M16 77 C36 67, 56 38, 79 20"/></svg>{routeDots.map((dot, index) => <div key={dot.id} className={`airport-dot ${categoryClass(airports[dot.id].category)}`} style={{ left: `${dot.x}%`, top: `${dot.y}%` }}><i/><label>{dot.id}<small>{airports[dot.id].category}</small></label>{index < 2 && <span className="leg">{index ? '91 NM' : '83 NM'}</span>}</div>)}<div className="gairmet">G-AIRMET IFR<br/><small>NORTHERN CORRIDOR</small></div></div><div className="legend"><span><i className="vfr"/>VFR</span><span><i className="mvfr"/>MVFR</span><span><i className="ifr"/>IFR</span><span className="source">Scenario data, timestamped for judging</span></div></div>
      </section>

      <section className="flight-strip" id="route"><div><small>FLIGHT</small><b>KTPF <span>→</span> KTLH</b></div><div><small>DEPARTURE</small><b>SEP 2 · 6:00 PM ET</b></div><div><small>RULES / AIRCRAFT</small><b>VFR · C172</b></div><div><small>PILOT PROFILE</small><b>VFR ONLY</b></div><button onClick={runAssessment} disabled={running}>{running ? 'CHECKING ROUTE...' : assessment ? 'ROUTE CHECK COMPLETE ✓' : 'ASK AI TO CHECK ROUTE'}</button></section>

      <section className="evidence" id="evidence"><div className="section-title"><p className="eyebrow">ONE ROUTE. EVERY SIGNAL.</p><h2>Weather evidence the agent can actually read.</h2><p>Structured WebMCP tools expose airport conditions, forecast trends, route advisories, alternates, and provenance without asking an agent to scrape the screen.</p></div><div className="condition-grid">{demoRoute.stations.map((id, index) => <article key={id} className="condition"><div className="condition-top"><span>{index === 0 ? 'ORIGIN' : index === 2 ? 'DESTINATION' : 'EN ROUTE'}</span><b className={categoryClass(airports[id].category)}>{airports[id].category}</b></div><h3>{id}</h3><p>{airports[id].name}</p><code className="raw-metar">{observations[id].raw}</code><div className="numbers"><span><small>CEILING AGL</small><b>{airports[id].ceiling.toLocaleString()} FT</b></span><span><small>VISIBILITY</small><b>{airports[id].visibility} SM</b></span><span><small>SURFACE WIND</small><b>{airports[id].wind}</b></span><span><small>OBSERVED</small><b>2153Z</b></span></div><div className="taf"><small>TAF TREND</small><p>{forecasts[id]}</p></div><footer><i className={index ? 'down' : ''}/>{index ? 'Deteriorating toward departure' : 'Conditions steady'}</footer></article>)}</div><div className="advisory-strip"><span>G-AIRMET IFR</span><b>VALID 2100Z–0300Z</b><p>Ceilings below 1,000 FT and visibility below 3 SM forecast over the northern route corridor.</p><em>FORECAST ADVISORY · VERIFY WITH OFFICIAL SOURCE</em></div></section>

      <section className="national-weather"><div className="national-head"><div><p className="eyebrow">APPLE WEATHERKIT · NATIONAL CONTEXT</p><h2>A living weather layer,<br/>beyond one route.</h2></div><p>WeatherKit samples current cloud cover, precipitation, wind, and temperature across the United States. Aviation Weather Center data remains the source for flight categories and advisories.</p></div><div className="us-weather-map"><div className="usa-shape">USA</div><div className="cloud-band band-one"/><div className="cloud-band band-two"/>{liveContext?.weatherSamples?.map(sample => <div key={sample.name} className="weather-sample" style={{ left: `${sample.x}%`, top: `${sample.y}%`, '--cloud': Math.max(.16, sample.cloudCover || 0) }}><i/><span><b>{sample.name}</b><small>{Math.round((sample.cloudCover || 0) * 100)}% cloud · {Math.round(sample.temperature)}°C</small></span></div>)}{!liveContext && <button onClick={loadLiveContext}>LOAD LIVE U.S. WEATHERKIT LAYER <span>→</span></button>}<div className="flight-animation"><span className="plane">✈</span><i/><b>KTPF → KTLH</b></div><div className="ai-callout"><small>AI ROUTE WATCH</small><p>“Cloud cover is building north of Cross City. Want me to keep watching the route?”</p></div></div><footer><span>Weather data provided by Apple WeatherKit</span><span>{liveContext ? `12 LIVE SAMPLE POINTS · ${new Date(liveContext.appleAsOf).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'LIVE LAYER LOADS ON REQUEST'}</span></footer></section>

      <section className="route-watch"><div><p className="eyebrow">DEMO NOTIFICATIONS · PILOT CONTROLLED</p><h2>Watch the route without pretending to fly the airplane.</h2><p>IMC Guardian can monitor material changes to ceilings, visibility, advisories, and alternate conditions. Alerts remain short and defer to cockpit workload.</p><div className="priority"><b>AVIATE</b><span>Maintain aircraft control</span><b>NAVIGATE</b><span>Know position and intended path</span><b>COMMUNICATE</b><span>Use ATC or Flight Service as appropriate</span></div></div><div className="watch-card"><div className="watch-head"><span><i className={watching ? 'on' : ''}/> ROUTE WATCH</span><b>{watching ? 'ACTIVE DEMO' : 'OFF'}</b></div><label>TRIGGER WHEN<select defaultValue="category"><option value="category">Flight category worsens</option><option value="ceiling">Ceiling falls below personal minimum</option><option value="advisory">New advisory intersects route</option></select></label><label>DELIVERY<div className="delivery"><button className="selected">IN APP</button><button>BROWSER</button><button>SMS LATER</button></div></label><button className="watch-action" onClick={enableRouteWatch}>{watching ? 'ROUTE WATCH ENABLED ✓' : 'ENABLE DEMO NOTIFICATIONS'}</button>{alertVisible && <div className="weather-alert"><div><span>DEMO ALERT · 2 MIN AGO</span><b>KTLH ceiling trend worsened</b><p>Forecast ceiling changed from 1,200 FT to 700 FT temporarily. G-AIRMET IFR still overlaps the route.</p></div><strong>AVIATION ATTENTION CUE</strong><small>Aviate first. Review when workload permits. Contact ATC or Flight Service for operational information. This alert does not direct a maneuver.</small></div>}</div></section>

      <section className={`assessment ${assessment ? 'revealed' : ''}`}><div><p className="eyebrow">EXPLAINABLE ROUTE ASSESSMENT</p><h2>{assessment ? assessment.headline : 'Ask once. Inspect every factor.'}</h2><p>{assessment ? assessment.recommendation : 'The agent assembles evidence and alternatives, but it cannot clear the flight or make the pilot’s decision.'}</p></div><div className="risk"><span>ROUTE RISK</span><b>{assessment?.level || 'PENDING'}</b><small>{assessment ? '3 material factors found' : 'Run the route check'}</small></div>{assessment && <ul>{assessment.factors.map(item => <li key={item}><i/> {item}</li>)}</ul>}</section>

      <section className="decision" id="decision"><div className="decision-copy"><p className="eyebrow">HUMAN DECISION CHECKPOINT</p><h2>The AI does not say<br/>“safe to fly.”</h2><p>It makes the pressure points visible, finds comparatively better options, and hands the decision back to the pilot.</p><blockquote>“What changes if I delay, divert, or cancel?”</blockquote></div><div className="options"><h3>Options for the pilot to review</h3><button className={decision === 'delay' ? 'selected' : ''} onClick={() => setDecision('delay')}><span>01</span><div><b>Delay and reassess</b><small>Keep the decision open while conditions update</small></div><em>LOWER EXPOSURE</em></button><button className={decision === 'alternate' ? 'selected' : ''} onClick={() => setDecision('alternate')}><span>02</span><div><b>Review VFR alternates</b><small>{alternates.length || 3} nearby stations report VFR in this scenario</small></div><em>COMPARE</em></button><button className={decision === 'cancel' ? 'selected' : ''} onClick={() => setDecision('cancel')}><span>03</span><div><b>Cancel the flight</b><small>Remove schedule pressure from the decision</small></div><em>AVAILABLE</em></button><button className="record" disabled={!decision} onClick={() => invoke('record_pilot_decision', { choice: decision })}>{decision ? 'Record my decision' : 'Pilot choice required'} <span>→</span></button></div></section>

      <section className="trace"><div><p className="eyebrow">LIVE WEBMCP TRACE</p><h2>See what the agent received.</h2></div><div className="trace-panel"><div className="trace-head"><span><i/> DOCUMENT.MODELCONTEXT</span><b>{state.events.length} CALLS</b></div>{state.events.length ? state.events.slice(-6).reverse().map((event, index) => <details key={`${event.name}-${index}`} open={index === 0}><summary><span>{String(state.events.length - index).padStart(2, '0')}</span><b>{event.name}</b><em>SUCCESS</em></summary><pre>{JSON.stringify(event.output, null, 2)}</pre></details>) : <div className="empty">Run the route demo to watch structured inputs and outputs move between the AI and the page.</div>}</div></section>
    </main>
    <footer className="site-footer"><b>IMC GUARDIAN</b><p>Prototype decision support. Always obtain an official weather briefing and exercise pilot-in-command judgment.</p><span>Data capability: NOAA Aviation Weather Center</span></footer>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
