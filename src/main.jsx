import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/land-110m.json";
import { createGuardianEngine } from "./engine.js";
import { installWebMcp, toolDefinitions } from "./webmcp.js";
import { airports, demoRoute, forecasts, observations } from "./scenario.js";
import "./presentation.css";

const LIVE_CACHE_KEY = "imc-guardian-live-context-v3";
const LIVE_CACHE_MS = 15 * 60 * 1000;
const views = [
  ["overview", "Overview"],
  ["route", "Route weather"],
  ["world", "Live world"],
  ["agent", "AI agent"],
  ["alerts", "Smart alerts"],
  ["tools", "WebMCP trace"],
];
const routeStops = [
  { id: "KTPF", x: 11, y: 75, label: "Tampa" },
  { id: "KCTY", x: 50, y: 44, label: "Cross City" },
  { id: "KTLH", x: 88, y: 20, label: "Tallahassee" },
];
const worldLand = feature(worldAtlas, worldAtlas.objects.land);
const worldProjection = geoNaturalEarth1().fitExtent(
  [
    [28, 18],
    [972, 482],
  ],
  worldLand,
);
const worldLandPath = geoPath(worldProjection)(worldLand);
const categoryClass = (value = "") => value.toLowerCase().replace(/\s/g, "-");
const formatCondition = (value = "Current") => value.replace(/([a-z])([A-Z])/g, "$1 $2");
const formatObserved = (value) => {
  if (!value) return "TIME UNAVAILABLE";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TIME UNAVAILABLE";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
};

function PlaneIcon() {
  return (
    <svg viewBox="0 0 42 42" aria-hidden="true">
      <path d="M38.5 18.5 24 14l-5.5-11h-4l2 11L7 17 3 13H1l2 8-2 8h2l4-4 9.5 3-2 11h4L24 28l14.5-4.5c3-1 3-4 0-5Z" />
    </svg>
  );
}

function WeatherRoute({ liveReportsById, routeRun, compact = false }) {
  const progress = routeRun.status === "idle" ? 4 : routeRun.step < 2 ? 11 : routeRun.step < 4 ? 50 : 88;
  const altitude = routeRun.status === "idle" ? 70 : routeRun.step < 2 ? 72 : routeRun.step < 4 ? 44 : 20;
  return (
    <div className={`weather-route ${compact ? "compact" : ""} ${routeRun.status}`}>
      <div className="radar-ring radar-a" />
      <div className="radar-ring radar-b" />
      <div className="storm-field storm-one"><i /><i /><i /></div>
      <div className="storm-field storm-two"><i /><i /><i /></div>
      <svg className="route-line" viewBox="0 0 1000 430" preserveAspectRatio="none">
        <defs>
          <linearGradient id={compact ? "compactRoute" : "mainRoute"} x1="0" x2="1">
            <stop offset="0" stopColor="#63ed9d" />
            <stop offset="0.5" stopColor="#67a9ff" />
            <stop offset="1" stopColor="#ff6d57" />
          </linearGradient>
        </defs>
        <path d="M110 325 C335 298 560 148 880 88" stroke={`url(#${compact ? "compactRoute" : "mainRoute"})`} />
      </svg>
      <div className="runway runway-start"><span>27</span><i /><span>09</span></div>
      <div className="runway runway-end"><span>18</span><i /><span>36</span></div>
      {routeStops.map((stop, index) => {
        const category = liveReportsById[stop.id]?.fltCat || airports[stop.id].category;
        return (
          <div className={`route-stop stop-${index} ${categoryClass(category)}`} style={{ left: `${stop.x}%`, top: `${stop.y}%` }} key={stop.id}>
            <i />
            <span><b>{stop.label}</b><small>{stop.id} · {category}</small></span>
          </div>
        );
      })}
      <div className="route-plane" style={{ left: `${progress}%`, top: `${altitude}%` }}>
        <PlaneIcon />
        <span>{routeRun.status === "checking" ? "SCANNING" : routeRun.status === "complete" ? "CHECKED" : "N172IG"}</span>
      </div>
      <div className="route-distance"><span>174 NM</span><i /><span>01:34 EST.</span></div>
    </div>
  );
}

function App() {
  const engine = useMemo(() => createGuardianEngine(), []);
  const [, redraw] = useState(0);
  const [view, setView] = useState("overview");
  const [nativeCount, setNativeCount] = useState(0);
  const [routeRun, setRouteRun] = useState({ status: "idle", step: -1 });
  const [liveContext, setLiveContext] = useState(null);
  const [liveError, setLiveError] = useState("");
  const [liveLoading, setLiveLoading] = useState(false);
  const [watching, setWatching] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [decision, setDecision] = useState("");
  const [aiRun, setAiRun] = useState({
    status: "idle",
    prompt: "I am flying VFR from Tampa to Tallahassee at 6 PM in a C172. Check my route and watch for worsening weather.",
    plan: [],
    active: -1,
    model: "",
    usage: null,
    error: "",
  });
  const state = engine.state;

  const navigate = (next) => {
    setView(next);
    window.history.replaceState(null, "", `#${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const invoke = (name, input = {}) => {
    try {
      const output = engine.run(name, input);
      redraw((value) => value + 1);
      return output;
    } catch (error) {
      window.alert(error.message);
      return null;
    }
  };
  const runAssessment = async (moveToRoute = false) => {
    if (routeRun.status === "checking") return;
    if (moveToRoute) navigate("route");
    setRouteRun({ status: "checking", step: 0 });
    const calls = [
      ["set_flight_context", demoRoute],
      ["check_airport_conditions", { airportIds: demoRoute.stations }],
      ["check_route_advisories", {}],
      ["assess_route_weather", {}],
      ["find_safer_alternates", {}],
      ["compare_route_options", {}],
    ];
    for (let index = 0; index < calls.length; index += 1) {
      setRouteRun({ status: "checking", step: index });
      invoke(calls[index][0], calls[index][1]);
      await new Promise((resolve) => window.setTimeout(resolve, 280));
    }
    setRouteRun({ status: "complete", step: calls.length });
  };
  const loadLiveContext = async (moveToWorld = false) => {
    if (moveToWorld) navigate("world");
    setLiveError("");
    setLiveLoading(true);
    try {
      const cached = sessionStorage.getItem(LIVE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - new Date(parsed.checkedAt).getTime() < LIVE_CACHE_MS) {
          setLiveContext({ ...parsed, cache: "browser" });
          return;
        }
      }
      const [awcResponse, appleResponse] = await Promise.all([
        fetch("/api/weather?type=metar&ids=KTPF,KCTY,KTLH&format=json"),
        fetch("/api/weatherkit?scope=global"),
      ]);
      if (!awcResponse.ok || !appleResponse.ok) throw new Error(`AWC ${awcResponse.status} / WeatherKit ${appleResponse.status}`);
      const [awc, apple] = await Promise.all([awcResponse.json(), appleResponse.json()]);
      const context = {
        awcReports: Array.isArray(awc) ? awc.length : 0,
        reports: Array.isArray(awc) ? awc : [],
        appleAsOf: apple.samples?.[0]?.asOf || "available",
        weatherSamples: apple.samples || [],
        checkedAt: new Date().toISOString(),
        cache: "network",
      };
      setLiveContext(context);
      sessionStorage.setItem(LIVE_CACHE_KEY, JSON.stringify(context));
    } catch (error) {
      setLiveError(error.message);
    } finally {
      setLiveLoading(false);
    }
  };
  const enableRouteWatch = async () => {
    if (!state.route) invoke("set_flight_context", demoRoute);
    invoke("configure_route_watch", { trigger: "ceiling_below_threshold", ceilingThresholdFt: 1500, visibilityThresholdSm: 5, delivery: "in_app" });
    const change = invoke("check_route_changes");
    if (change?.alert?.id) invoke("validate_weather_alert", { alertId: change.alert.id });
    setWatching(true);
    setAlertVisible(true);
    if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("IMC Guardian demo alert", { body: "KTLH ceiling trend worsened. Aviate first. Review when workload permits." });
    }
  };
  const runAiDemo = async () => {
    setAiRun((current) => ({ ...current, status: "planning", plan: [], active: -1, error: "" }));
    try {
      const response = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: aiRun.prompt }) });
      const plan = await response.json();
      if (!response.ok) throw new Error(plan.detail || plan.error || `AI returned ${response.status}`);
      setAiRun((current) => ({ ...current, status: "executing", plan: plan.toolPlan, model: plan.model, usage: plan.usage }));
      const inputs = {
        set_flight_context: demoRoute,
        check_airport_conditions: { airportIds: demoRoute.stations },
        configure_route_watch: { trigger: "ceiling_below_threshold", ceilingThresholdFt: 1500, visibilityThresholdSm: 5, delivery: "in_app" },
      };
      if (!plan.toolPlan.includes("set_flight_context")) invoke("set_flight_context", demoRoute);
      for (let index = 0; index < plan.toolPlan.length; index += 1) {
        setAiRun((current) => ({ ...current, active: index }));
        const input = plan.toolPlan[index] === "validate_weather_alert" ? { alertId: engine.state.alert?.id } : inputs[plan.toolPlan[index]] || {};
        invoke(plan.toolPlan[index], input);
        await new Promise((resolve) => window.setTimeout(resolve, 360));
      }
      setAiRun((current) => ({ ...current, status: "complete", active: plan.toolPlan.length }));
      setRouteRun({ status: "complete", step: 6 });
    } catch (error) {
      setAiRun((current) => ({ ...current, status: "error", error: error.message }));
    }
  };

  useEffect(() => {
    const initialView = window.location.hash.slice(1);
    if (views.some(([id]) => id === initialView)) setView(initialView);
    installWebMcp(engine, () => redraw((value) => value + 1)).then(setNativeCount);
    const preload = window.setTimeout(() => loadLiveContext(false), 600);
    return () => window.clearTimeout(preload);
  }, [engine]);

  const assessment = state.assessment;
  const liveReportsById = Object.fromEntries((liveContext?.reports || []).map((report) => [report.icaoId, report]));
  const alternates = state.events.findLast?.((event) => event.name === "find_safer_alternates")?.output.alternates || [];

  return (
    <div className="presentation-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate("overview")}>
          <span className="brand-mark">IG</span>
          <span><b>IMC GUARDIAN</b><small>SMART WEATHER NOTIFICATIONS</small></span>
        </button>
        <nav aria-label="Presentation views">
          {views.map(([id, label]) => <button className={view === id ? "active" : ""} onClick={() => navigate(id)} key={id}>{label}</button>)}
        </nav>
        <div className="system-ready"><i /> {nativeCount || toolDefinitions.length} TOOLS READY</div>
      </header>

      <main>
        <section className={`view overview-view ${view === "overview" ? "active" : ""}`} data-view="overview">
          <div className="overview-copy">
            <p className="kicker">PERSONAL WEATHER WATCH FOR GENERAL AVIATION</p>
            <h1>A second pair of eyes on <em>changing weather.</em></h1>
            <p>IMC Guardian watches the conditions that matter to your flight, detects meaningful deterioration, and gives you a focused alert before the signal gets lost in the noise.</p>
            <div className="hero-actions">
              <button className="primary" onClick={() => runAssessment(true)}>RUN TAMPA ROUTE DEMO <span>→</span></button>
              <button className="secondary" onClick={() => loadLiveContext(true)}>{liveLoading ? "LOADING LIVE WEATHER" : "EXPLORE LIVE WEATHER"}</button>
            </div>
            <div className="hero-metrics">
              <span><b>12</b><small>NATIVE WEBMCP TOOLS</small></span>
              <span><b>2×</b><small>ALERT VALIDATION</small></span>
              <span><b>15m</b><small>BROWSER CACHE</small></span>
            </div>
            <p className="safety-line">Decision support only. Not an official briefing, clearance, or go/no-go determination.</p>
          </div>
          <div className="overview-visual">
            <div className="visual-head"><span>DEMO FLIGHT · SEP 02 · 18:00 ET</span><b>WEATHER WATCH READY</b></div>
            <WeatherRoute liveReportsById={{}} routeRun={routeRun} compact />
            <div className="condition-ribbon">
              <span className="vfr"><i /> TAMPA <b>VFR</b></span>
              <span className="mvfr"><i /> CROSS CITY <b>MVFR</b></span>
              <span className="ifr"><i /> TALLAHASSEE <b>IFR</b></span>
            </div>
            <div className="visual-alert"><span>FORECAST CHANGE</span><b>Ceilings deteriorating northbound</b><em>G-AIRMET IFR</em></div>
          </div>
          <div className="view-index">01 <span>/ 06</span></div>
        </section>

        <section className={`view route-view ${view === "route" ? "active" : ""}`} data-view="route">
          <div className="view-title route-title">
            <div><p className="kicker">ROUTE WEATHER STORY</p><h2>Watch VFR deteriorate along one real route.</h2></div>
            <p>A reproducible Tampa to Tallahassee scenario makes each weather change and each WebMCP call easy to see.</p>
          </div>
          <div className="route-stage">
            <div className="route-stage-main">
              <div className="stage-head"><span>KTPF → KTLH · 174 NM</span><b>{routeRun.status === "checking" ? `CHECKING SIGNAL ${routeRun.step + 1} / 6` : routeRun.status === "complete" ? "ROUTE CHECK COMPLETE" : "READY TO CHECK"}</b></div>
              <WeatherRoute liveReportsById={{}} routeRun={routeRun} />
              <div className={`deterioration-alert ${assessment ? "visible" : ""}`}><span>DETERIORATION DETECTED</span><b>KTLH: 900 FT ceiling · 3 SM visibility</b><em>HIGH ATTENTION</em></div>
            </div>
            <aside className="route-control">
              <div className="flight-profile"><span>FLIGHT PROFILE</span><h3>Tampa to Tallahassee</h3><p>VFR · C172 · VFR-only pilot</p></div>
              <div className="signal-list">
                {["Flight context", "Airport conditions", "Route advisories", "Risk assessment", "Safer alternates", "Compare options"].map((label, index) => <div className={routeRun.step >= index ? "done" : ""} key={label}><i>{routeRun.step > index ? "✓" : index + 1}</i><span>{label}</span><em>{routeRun.step === index && routeRun.status === "checking" ? "CHECKING" : routeRun.step > index ? "COMPLETE" : "WAITING"}</em></div>)}
              </div>
              <button className="run-route" onClick={() => runAssessment(false)} disabled={routeRun.status === "checking"}>{routeRun.status === "checking" ? "ROUTE CHECK IN PROGRESS" : routeRun.status === "complete" ? "RUN ROUTE AGAIN" : "RUN ROUTE EVIDENCE"}<span>→</span></button>
            </aside>
          </div>
          <div className="evidence-grid">
            {demoRoute.stations.map((id, index) => <article className={categoryClass(airports[id].category)} key={id}><header><span>{index === 0 ? "ORIGIN" : index === 2 ? "DESTINATION" : "EN ROUTE"}</span><b>{airports[id].category}</b></header><h3>{id}</h3><p>{airports[id].name}</p><div><span><small>CEILING</small><b>{airports[id].ceiling.toLocaleString()} FT</b></span><span><small>VISIBILITY</small><b>{airports[id].visibility} SM</b></span><span><small>WIND</small><b>{airports[id].wind}</b></span></div><code>{observations[id].raw}</code><footer><span>TAF TREND</span>{forecasts[id]}</footer></article>)}
          </div>
          <div className="assessment">
            <div><p className="kicker">EXPLAINABLE ASSESSMENT</p><h3>{assessment?.headline || "Run the route to assemble the complete picture."}</h3><p>{assessment?.recommendation || "The system will connect observations, forecasts, advisories, and alternatives without making the pilot's decision."}</p></div>
            <div className="risk-score"><span>ATTENTION</span><b>{assessment?.level || "READY"}</b><small>{assessment ? "3 MATERIAL FACTORS" : "WAITING FOR ROUTE"}</small></div>
          </div>
          <div className="decision">
            <div><p className="kicker">PILOT DECISION BOUNDARY</p><h3>The system finds pressure points. The pilot chooses.</h3></div>
            <div className="decision-options">{[["delay", "Delay and reassess"], ["alternate", `Review ${alternates.length || 3} VFR alternates`], ["cancel", "Cancel the flight"]].map(([value, label], index) => <button className={decision === value ? "selected" : ""} onClick={() => setDecision(value)} key={value}><span>0{index + 1}</span><b>{label}</b><i>→</i></button>)}</div>
          </div>
        </section>

        <section className={`view world-view national-weather ${view === "world" ? "active" : ""}`} data-view="world">
          <div className="view-title world-title"><div><p className="kicker">APPLE WEATHERKIT · LIVE GLOBAL ENVIRONMENT</p><h2>A living weather layer, beyond one route.</h2></div><p>Current cloud cover, precipitation, wind, and temperature create broader environmental awareness. Aviation categories remain sourced from AWC.</p></div>
          <div className="world-layout">
            <div className="world-stage">
              <div className="earth-glow" /><div className="globe-grid" />
              <svg className="world-outline" viewBox="0 0 1000 500" aria-hidden="true"><path d={worldLandPath} /></svg>
              <div className="cloud-system cloud-a"><i /><i /><i /></div><div className="cloud-system cloud-b"><i /><i /><i /></div><div className="cloud-system cloud-c"><i /><i /><i /></div>
              {(liveContext?.weatherSamples || []).map((sample) => { const position = worldProjection([sample.lon, sample.lat]); if (!position) return null; const [x, y] = position; return <div key={sample.name} className={`weather-sample ${x > 750 ? "right-label" : ""}`} style={{ left: `${x / 10}%`, top: `${y / 5}%`, "--cloud": Math.max(0.2, sample.cloudCover || 0) }}><i /><span><b>{sample.name}</b><small>{formatCondition(sample.conditionCode)} · {Math.round(sample.temperature)}°C · {Math.round(sample.windSpeed || 0)} km/h</small></span></div>; })}
              <div className="global-status"><span>LIVE GLOBAL SNAPSHOT</span><b>{liveContext?.weatherSamples.length || "…"} weather points</b><small>{liveContext ? `UPDATED ${formatObserved(liveContext.appleAsOf)}` : "CONNECTING TO WEATHERKIT"}</small></div>
            </div>
            <aside className="live-comparison">
              <header><span><i /> LIVE SOURCE CHECK</span><b>{liveLoading ? "LOADING" : liveContext ? "CONNECTED" : "STANDING BY"}</b></header>
              <h3>Scenario versus now</h3><p>See exactly what changed without mixing the demo scenario with today's reports.</p>
              <div className="comparison-list">
                {demoRoute.stations.map((id) => { const report = liveReportsById[id]; const scenario = airports[id].category; const current = report?.fltCat || "WAIT"; const changed = scenario !== current; return <article className={changed ? "changed" : ""} key={id}><div><b>{id}</b><small>{airports[id].city}</small></div><div><span className={categoryClass(scenario)}>{scenario}</span><i>→</i><span className={categoryClass(current)}>{current}</span></div><strong>{changed ? "CHANGED" : "MATCH"}</strong><small>{formatObserved(report?.reportTime)}</small></article>; })}
              </div>
              <button onClick={() => loadLiveContext(false)} disabled={liveLoading}>{liveLoading ? "REFRESHING LIVE SOURCES" : "REFRESH LIVE SOURCES"}</button>
              <footer>AWC: 60 sec edge cache · WeatherKit: 1 hour · Browser: 15 min</footer>
              {liveError && <div className="inline-error">{liveError}</div>}
            </aside>
          </div>
          <div className="weather-attribution">Weather data provided by Apple WeatherKit</div>
        </section>

        <section className={`view agent-view ${view === "agent" ? "active" : ""}`} data-view="agent">
          <div className="view-title"><div><p className="kicker">LIVE AI PLANNER + NATIVE WEBMCP</p><h2>Ask once. Watch every weather check.</h2></div><p>The AI selects an allowlisted plan. Site-owned tools supply evidence, validate alerts, and leave the decision with the pilot.</p></div>
          <div className="agent-workspace">
            <div className="pilot-request">
              <div className="pilot-profile"><span>FC</span><div><small>PILOT PROFILE</small><b>Home: Tampa · VFR only</b></div><em>C172</em></div>
              <label htmlFor="pilot-prompt">PILOT REQUEST</label>
              <textarea id="pilot-prompt" value={aiRun.prompt} onChange={(event) => setAiRun((current) => ({ ...current, prompt: event.target.value }))} />
              <div className="request-route"><span><small>FROM</small><b>KTPF</b><em>Tampa</em></span><i>→</i><span><small>TO</small><b>KTLH</b><em>Tallahassee</em></span><span><small>DEPART</small><b>18:00</b><em>Sep 02</em></span></div>
              <button onClick={runAiDemo} disabled={aiRun.status === "planning" || aiRun.status === "executing"}>{aiRun.status === "planning" ? "BUILDING CHECK PLAN..." : aiRun.status === "executing" ? `RUNNING TOOL ${aiRun.active + 1} OF ${aiRun.plan.length}` : "RUN LIVE AI DEMO"}<span>→</span></button>
            </div>
            <div className="agent-console">
              <header><span><i /> AGENT OPERATION CENTER</span><b>{aiRun.model ? aiRun.model.replace("openai/", "") : "STANDING BY"}</b></header>
              <div className="agent-route"><span><i /> KTPF<small>PILOT HOME</small></span><div><b className={aiRun.status === "executing" ? "moving" : ""}>✈</b></div><span><i /> KTLH<small>DESTINATION</small></span></div>
              <div className="current-operation"><small>CURRENT OPERATION</small><h3>{aiRun.status === "idle" && "Ready to inspect the Tampa route"}{aiRun.status === "planning" && "Understanding the pilot request"}{aiRun.status === "executing" && aiRun.plan[aiRun.active]?.replaceAll("_", " ")}{aiRun.status === "complete" && "Route evidence assembled and validated"}{aiRun.status === "error" && "AI planner needs attention"}</h3><div><i style={{ width: aiRun.plan.length ? `${Math.min(100, ((aiRun.active + 1) / aiRun.plan.length) * 100)}%` : "0%" }} /></div></div>
              <div className="tool-sequence">{aiRun.plan.length ? aiRun.plan.map((name, index) => <div className={index < aiRun.active ? "done" : index === aiRun.active ? "active" : "queued"} key={`${name}-${index}`}><span>{index < aiRun.active ? "✓" : String(index + 1).padStart(2, "0")}</span><b>{name}</b><em>{index < aiRun.active ? "SHARED WITH UI" : index === aiRun.active ? "RUNNING" : "QUEUED"}</em></div>) : <div className="empty-tools">The selected WebMCP tools will appear here in execution order.</div>}</div>
              {aiRun.status === "complete" && <div className="agent-outcome"><div><span>ROUTE WATCH RESULT</span><b>HIGH ATTENTION</b></div><h3>{assessment?.headline}</h3><p>{assessment?.worstCondition}</p><footer><strong>✓ EVIDENCE DOUBLE-CHECKED</strong><span>{aiRun.usage?.total_tokens ? `${aiRun.usage.total_tokens} MODEL TOKENS` : "VALIDATED FALLBACK PLAN"}</span></footer></div>}
              {aiRun.error && <div className="inline-error">{aiRun.error}</div>}
            </div>
          </div>
        </section>

        <section className={`view alerts-view ${view === "alerts" ? "active" : ""}`} data-view="alerts">
          <div className="alerts-copy"><p className="kicker">SMART NOTIFICATIONS</p><h2>Configure what deserves your attention.</h2><p>A pilot sets personal thresholds once. IMC Guardian watches for meaningful change, double-checks the evidence, and produces a concise attention cue.</p><div className="alert-principles"><span><b>01</b>FOCUS ON ONE IMPORTANT METRIC</span><span><b>02</b>VALIDATE AGAINST RELATED EVIDENCE</span><span><b>03</b>DEFER TO COCKPIT WORKLOAD</span></div></div>
          <div className="notification-builder">
            <header><span><i className={watching ? "on" : ""} /> SECOND PAIR OF EYES</span><b>{watching ? "MONITORING" : "READY"}</b></header>
            <div className="thresholds"><label>WATCH METRIC<select defaultValue="ceiling"><option value="ceiling">Ceiling AGL</option><option>Visibility</option><option>Flight category</option><option>New route advisory</option></select></label><label>ALERT BELOW<div>1,500 <span>FT</span></div></label></div>
            <div className="delivery"><span>DELIVER TO</span><button className="selected">IN APP</button><button>BROWSER</button><button>SMS LATER</button></div>
            <button className="enable-watch" onClick={enableRouteWatch}>{watching ? "SECOND PAIR OF EYES ACTIVE ✓" : "ENABLE ROUTE WATCH"}</button>
            {alertVisible && <div className="validated-alert"><header><span>CRITICAL CHANGE · DEMO</span><b>DOUBLE-CHECKED ✓</b></header><h3>KTLH ceiling crossed your 1,500 FT threshold.</h3><p>Temporary 700 FT ceiling is consistent with the forecast and overlapping G-AIRMET IFR scenario.</p><div><span>THRESHOLD ✓</span><span>FORECAST ✓</span><span>ADVISORY ✓</span></div><small>Aviate first. Review when workload permits. This alert does not direct a maneuver.</small></div>}
          </div>
          <div className="aviate-strip"><span><b>AVIATE</b> Maintain aircraft control</span><span><b>NAVIGATE</b> Know position and intended path</span><span><b>COMMUNICATE</b> Use ATC or Flight Service as appropriate</span></div>
        </section>

        <section className={`view tools-view trace ${view === "tools" ? "active" : ""}`} data-view="tools">
          <div className="tools-intro"><p className="kicker">THE TECHNICAL LAYER</p><h2>The weather story becomes structured agent context.</h2><p>WebMCP gives an agent explicit tools for route context, conditions, advisories, risk, alternatives, monitoring, validation, and the human decision boundary.</p><div className="tool-count"><b>{toolDefinitions.length}</b><span>NATIVE SITE TOOLS<br />REGISTERED</span></div></div>
          <div className="trace-console"><header><span><i /> DOCUMENT.MODELCONTEXT</span><b>{state.events.length} CALLS</b></header>{state.events.length ? state.events.slice(-7).reverse().map((event, index) => <details key={`${event.name}-${index}`} open={index === 0}><summary><span>{String(state.events.length - index).padStart(2, "0")}</span><b>{event.name}</b><em>SUCCESS</em></summary><pre>{JSON.stringify(event.output, null, 2)}</pre></details>) : <div className="trace-empty">Run the route or AI demo. Every structured input and output will appear here.</div>}</div>
          <div className="tool-library">{toolDefinitions.map(([name, description], index) => <article key={name}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{name}</b><p>{description}</p></div></article>)}</div>
        </section>
      </main>

      <footer className="presentation-footer"><span>IMC GUARDIAN · WEBMCP CHALLENGE PROTOTYPE</span><p>Always obtain an official weather briefing and exercise pilot-in-command judgment.</p><b>NOAA AWC + APPLE WEATHERKIT</b></footer>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
