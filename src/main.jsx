import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createGuardianEngine } from "./engine.js";
import { installWebMcp, toolDefinitions } from "./webmcp.js";
import { airports, demoRoute, forecasts, observations } from "./scenario.js";
import CesiumWeatherGlobe from "./CesiumWeatherGlobe.jsx";
import "./styles.css";
import "./live.css";
import "./national.css";
import "./ai.css";
import "./max.css";
import "./story.css";

const routeDots = [
  { x: 16, y: 77, id: "KTPF" },
  { x: 47, y: 49, id: "KCTY" },
  { x: 79, y: 20, id: "KTLH" },
];
const caseStudies = [
  {
    year: "2025",
    label: "SEVERE TURBULENCE · DIVERSION",
    flight: "DELTA 56",
    route: "SLC → AMS · DIVERTED TO MSP",
    headline: "They had already changed course around weather.",
    detail:
      "The NTSB says the aircraft encountered severe turbulence at FL370 after the crew accepted an ATC-proposed deviation. The upset lasted about 2.5 minutes. Two crew members were seriously injured and the flight diverted to Minneapolis.",
    lesson:
      "A deviation is not the end of the monitoring problem. Conditions and the route picture keep changing.",
    source: "NTSB PRELIMINARY REPORT",
    href: "https://data.ntsb.gov/carol-repgen/api/Aviation/ReportMain/GenerateNewestReport/200672/pdf",
  },
  {
    year: "2023",
    label: "RAPIDLY DEVELOPING CONVECTION",
    flight: "DELTA 175",
    route: "MXP → ATL",
    headline: "The cell was not apparent on the displays.",
    detail:
      "The NTSB found that a rapidly developing, low-precipitation cloud produced severe turbulence that was not apparent on aircraft radar or ATC scopes. Four people were seriously injured and thirteen received minor injuries.",
    lesson:
      "A second source should challenge the picture when new evidence arrives, not simply confirm the current plan.",
    source: "NTSB FINAL REPORT",
    href: "https://data.ntsb.gov/carol-repgen/api/Aviation/ReportMain/GenerateNewestReport/192959/pdf",
  },
  {
    year: "2024",
    label: "CONVECTIVE TURBULENCE · DIVERSION",
    flight: "SINGAPORE 321",
    route: "LHR → SIN · DIVERTED TO BKK",
    headline: "The critical acceleration change took seconds.",
    detail:
      "Singapore's TSIB recorded a rapid change from +1.35G to -1.5G in 0.6 seconds over developing convective activity. The pilots stabilized the aircraft and diverted to Bangkok after learning of injuries.",
    lesson:
      "When the situation changes quickly, the useful alert is the short, prioritized one the crew can absorb.",
    source: "SINGAPORE TSIB",
    href: "https://www.mot.gov.sg/news-resources/newsroom/transport-safety-investigation-bureau-preliminary-investigation-findings-of-incident-involving-sq321/",
  },
  {
    year: "2024",
    label: "SEVERE TURBULENCE · DIVERSION",
    flight: "AIR EUROPA 045",
    route: "MAD → MVD · DIVERTED TO NAT",
    headline: "A long route became an emergency diversion.",
    detail:
      "The Madrid-to-Montevideo flight diverted to Natal, Brazil after severe turbulence injured dozens of people. The aircraft landed normally and medical teams met the flight.",
    lesson:
      "Long routes need a continuously refreshed picture of weather ahead and viable places to land.",
    source: "AIRLINE STATEMENT VIA ABC NEWS",
    href: "https://abcnews.com/International/air-europa-flight-turbulence/story?id=111595157",
  },
  {
    year: "2009",
    label: "FOUNDATIONAL SENSOR CASE",
    flight: "AIR FRANCE 447",
    route: "GIG → CDG",
    headline: "Weather and unreliable airspeed collided.",
    detail:
      "France's BEA identified icing of the pitot probes, erroneous speed indications, a stall, and impact with the ocean. The investigation became a defining study of sensor disagreement and human-machine interaction.",
    lesson:
      "Independent context can expose disagreement, but only certified aircraft systems and trained crews can diagnose and respond.",
    source: "BEA FINAL INVESTIGATION",
    href: "https://bea.aero/en/investigation-reports/notified-events/detail/accident-to-the-airbus-a330-203-registered-f-gzcp-and-operated-by-air-france-occured-on-06-01-2009-in-the-atlantic-ocean/",
  },
];
const LIVE_CACHE_KEY = "imc-guardian-live-context-v2";
const LIVE_CACHE_MS = 15 * 60 * 1000;
const ROUTE_CACHE_KEY = "imc-guardian-tpa-jfk-v1";
const ROUTE_CACHE_MS = 60 * 60 * 1000;
const categoryClass = (value) => value.toLowerCase();
const formatCondition = (value = "Current") =>
  value.replace(/([a-z])([A-Z])/g, "$1 $2");
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

function App() {
  const engine = useMemo(() => createGuardianEngine(), []);
  const [, redraw] = useState(0);
  const [nativeCount, setNativeCount] = useState(0);
  const [mode, setMode] = useState("scenario");
  const [liveContext, setLiveContext] = useState(null);
  const [liveError, setLiveError] = useState("");
  const [liveLoading, setLiveLoading] = useState(false);
  const [routeContext, setRouteContext] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [showLiveComparison, setShowLiveComparison] = useState(false);
  const [running, setRunning] = useState(false);
  const [watching, setWatching] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [aiRun, setAiRun] = useState({
    status: "idle",
    prompt:
      "I am flying VFR from Tampa to Tallahassee at 6 PM in a C172. Check my route and watch for worsening weather.",
    plan: [],
    active: -1,
    model: "",
    message: "",
    usage: null,
    error: "",
  });
  const [decision, setDecision] = useState("");
  const state = engine.state;
  const invoke = (name, input = {}) => {
    try {
      const result = engine.run(name, input);
      redraw((n) => n + 1);
      return result;
    } catch (error) {
      alert(error.message);
      return null;
    }
  };
  const runAssessment = () => {
    setRunning(true);
    invoke("set_flight_context", demoRoute);
    invoke("check_airport_conditions", { airportIds: demoRoute.stations });
    invoke("check_route_advisories");
    invoke("assess_route_weather");
    invoke("find_safer_alternates");
    invoke("compare_route_options");
    window.setTimeout(() => {
      setRunning(false);
    }, 250);
  };
  const runAssessmentAndShow = () => {
    runAssessment();
    window.setTimeout(() => {
      document
        .querySelector("#ai-route-check")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 180);
  };
  const loadLiveContext = async (showPanel = true) => {
    setLiveError("");
    setLiveLoading(true);
    try {
      const cached = sessionStorage.getItem(LIVE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - new Date(parsed.checkedAt).getTime() < LIVE_CACHE_MS) {
          setLiveContext({ ...parsed, cache: "browser" });
          if (showPanel) {
            setMode("live");
            setShowLiveComparison(true);
          }
          setLiveLoading(false);
          return;
        }
      }
      const [awcResponse, appleResponse] = await Promise.all([
        fetch("/api/weather?type=metar&ids=KTPF,KCTY,KTLH&format=json"),
        fetch("/api/weatherkit?scope=global"),
      ]);
      if (!awcResponse.ok || !appleResponse.ok)
        throw new Error(
          `AWC ${awcResponse.status} / WeatherKit ${appleResponse.status}`,
        );
      const [awc, apple] = await Promise.all([
        awcResponse.json(),
        appleResponse.json(),
      ]);
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
      if (showPanel) {
        setMode("live");
        setShowLiveComparison(true);
      }
    } catch (error) {
      setLiveError(error.message);
      setMode("scenario");
    } finally {
      setLiveLoading(false);
    }
  };
  const loadRouteContext = async () => {
    setRouteError("");
    setRouteLoading(true);
    try {
      const cached = sessionStorage.getItem(ROUTE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - new Date(parsed.checkedAt).getTime() < ROUTE_CACHE_MS) {
          setRouteContext({ ...parsed, cache: "browser" });
          return;
        }
      }
      const response = await fetch("/api/weatherkit?scope=tpa-jfk");
      if (!response.ok) throw new Error(`WeatherKit ${response.status}`);
      const data = await response.json();
      const context = {
        ...data,
        checkedAt: new Date().toISOString(),
        cache: "network",
      };
      setRouteContext(context);
      sessionStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(context));
    } catch (error) {
      setRouteError(error.message);
    } finally {
      setRouteLoading(false);
    }
  };
  const enableRouteWatch = async () => {
    if (!state.route) invoke("set_flight_context", demoRoute);
    invoke("configure_route_watch", {
      trigger: "ceiling_below_threshold",
      ceilingThresholdFt: 1500,
      visibilityThresholdSm: 5,
      delivery: "in_app",
    });
    const change = invoke("check_route_changes");
    if (change?.alert?.id)
      invoke("validate_weather_alert", { alertId: change.alert.id });
    setWatching(true);
    setAlertVisible(true);
    if ("Notification" in window && Notification.permission === "default")
      await Notification.requestPermission();
    if ("Notification" in window && Notification.permission === "granted")
      new Notification("IMC Guardian demo alert", {
        body: "KTLH ceiling trend worsened. Aviate first. Review the new evidence when workload permits.",
      });
  };
  const runAiDemo = async () => {
    setAiRun((current) => ({
      ...current,
      status: "planning",
      plan: [],
      active: -1,
      error: "",
    }));
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiRun.prompt }),
      });
      const plan = await response.json();
      if (!response.ok)
        throw new Error(
          plan.detail || plan.error || `AI returned ${response.status}`,
        );
      setAiRun((current) => ({
        ...current,
        status: "executing",
        plan: plan.toolPlan,
        model: plan.model,
        message: plan.pilotMessage,
        usage: plan.usage,
      }));
      const inputs = {
        set_flight_context: demoRoute,
        check_airport_conditions: { airportIds: demoRoute.stations },
        configure_route_watch: {
          trigger: "ceiling_below_threshold",
          ceilingThresholdFt: 1500,
          visibilityThresholdSm: 5,
          delivery: "in_app",
        },
      };
      if (!plan.toolPlan.includes("set_flight_context"))
        invoke("set_flight_context", demoRoute);
      for (let index = 0; index < plan.toolPlan.length; index += 1) {
        setAiRun((current) => ({ ...current, active: index }));
        const input =
          plan.toolPlan[index] === "validate_weather_alert"
            ? { alertId: engine.state.alert?.id }
            : inputs[plan.toolPlan[index]] || {};
        invoke(plan.toolPlan[index], input);
        await new Promise((resolve) => window.setTimeout(resolve, 260));
      }
      setAiRun((current) => ({
        ...current,
        status: "complete",
        active: plan.toolPlan.length,
      }));
    } catch (error) {
      setAiRun((current) => ({
        ...current,
        status: "error",
        error: error.message,
      }));
    }
  };
  useEffect(() => {
    installWebMcp(engine, () => redraw((n) => n + 1)).then(setNativeCount);
    const preload = window.setTimeout(() => loadLiveContext(false), 500);
    return () => window.clearTimeout(preload);
  }, [engine]);
  useEffect(() => {
    const corridor = document.querySelector("#tampa-jfk");
    if (!corridor || routeContext || routeLoading) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          loadRouteContext();
        }
      },
      { rootMargin: "350px 0px" },
    );
    observer.observe(corridor);
    return () => observer.disconnect();
  }, [routeContext, routeLoading]);
  const assessment = state.assessment;
  const validatedAlert = state.events.findLast?.(
    (event) => event.name === "validate_weather_alert",
  )?.output;
  const liveReportsById = Object.fromEntries(
    (liveContext?.reports || []).map((report) => [report.icaoId, report]),
  );
  const alternates =
    state.events.findLast?.((event) => event.name === "find_safer_alternates")
      ?.output.alternates || [];
  return (
    <div className="app">
      <header>
        <a className="brand" href="#top">
          <span className="cloud-mark" aria-hidden="true">
            <svg viewBox="0 0 54 42" role="presentation">
              <path className="cloud-line" d="M13 33h28c6 0 10-4 10-9s-4-9-10-9h-2C37 8 32 4 25 4c-8 0-14 6-14 14C6 19 3 22 3 27c0 4 4 6 10 6Z" />
              <path className="route-line" d="M13 28c8-1 11-9 18-8 5 1 7 5 12 2" />
              <circle cx="13" cy="28" r="2" />
              <circle cx="43" cy="22" r="2" />
            </svg>
          </span>
          <span>
            <b>IMC GUARDIAN</b>
            <small>ROUTE WEATHER INTELLIGENCE</small>
          </span>
        </a>
        <nav>
          <a href="#ai-route-check">Live demo</a>
          <a href="#case-studies">Why it matters</a>
          <a href="#route-watch">Second Pair of Eyes</a>
          <a href="#tampa-jfk">Tampa → JFK</a>
        </nav>
        <div className="status">
          <i /> {nativeCount || toolDefinitions.length} WebMCP tools ready
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">A SECOND PAIR OF EYES FOR CHANGING WEATHER</p>
            <h1>
              See the weather change
              <br />
              <em>before it changes the flight.</em>
            </h1>
            <p className="lede">
              IMC Guardian watches the conditions that matter to your route,
              detects meaningful deterioration, and double-checks the evidence
              before it sends a focused alert.
            </p>
            <div className="hero-actions">
              <button
                className="primary"
                onClick={runAssessmentAndShow}
                disabled={running}
              >
                {running
                  ? "Checking 6 route signals..."
                  : assessment
                    ? "Route change found · review"
                    : "Check Tampa route for changes"}{" "}
                <span>→</span>
              </button>
              <button
                className="ghost"
                onClick={() => {
                  if (liveContext) {
                    setShowLiveComparison((visible) => {
                      setMode(visible ? "scenario" : "live");
                      return !visible;
                    });
                  } else {
                    loadLiveContext(true);
                  }
                }}
                disabled={liveLoading}
              >
                {liveLoading
                  ? "Checking AWC + Apple..."
                  : showLiveComparison
                    ? "Hide live comparison"
                    : liveContext
                      ? "Show live comparison"
                      : "Load live weather"}
              </button>
            </div>
            {assessment && (
              <p className="run-success">
                Route check complete. Six WebMCP calls are ready below.
              </p>
            )}
            {liveContext && (
              <p className="live-note">
                Live sources loaded: {liveContext.awcReports} AWC reports and{" "}
                {liveContext.weatherSamples.length} Apple WeatherKit locations.
                {liveContext.cache === "browser"
                  ? " Reused from this browser session."
                  : " Cached in this browser for 15 minutes."}
              </p>
            )}
            {liveError && (
              <p className="live-error">
                Live connection unavailable: {liveError}. Reproducible scenario
                remains active.
              </p>
            )}
            <p className="boundary">
              Decision support only. Not an official briefing, flight clearance,
              or go/no-go determination.
            </p>
          </div>
          <div className="radar-card">
            <div className="radar-head">
              <span>ROUTE WEATHER PICTURE</span>
              <b>
                {mode === "scenario" ? "REPRODUCIBLE SCENARIO" : "LIVE AWC"}
              </b>
            </div>
            <div className="map">
              <div className="hero-runway"><span>27</span><i /><span>09</span></div>
              <div className="hero-aircraft" aria-hidden="true">✈</div>
              <div className="weather weather-one" />
              <div className="weather weather-two" />
              <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M16 77 C36 67, 56 38, 79 20" />
              </svg>
              {routeDots.map((dot, index) =>
                (() => {
                  const liveReport = liveReportsById[dot.id];
                  const displayCategory =
                    mode === "live" && liveReport?.fltCat
                      ? liveReport.fltCat
                      : airports[dot.id].category;
                  return (
                    <div
                      key={dot.id}
                      className={`airport-dot ${categoryClass(displayCategory)}`}
                      style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
                    >
                      <i />
                      <label>
                        {dot.id}
                        <small>{displayCategory}</small>
                      </label>
                      {index < 2 && (
                        <span className="leg">{index ? "91 NM" : "83 NM"}</span>
                      )}
                    </div>
                  );
                })(),
              )}
              <div className="gairmet">
                {mode === "live" ? "DEMO G-AIRMET IFR" : "G-AIRMET IFR"}
                <br />
                <small>
                  {mode === "live" ? "SCENARIO ONLY" : "NORTHERN CORRIDOR"}
                </small>
              </div>
              {assessment && (
                <div className="hero-assessment-alert">
                  <span>WEATHER DETERIORATION DETECTED</span>
                  <b>KTLH · 900 FT ceiling · 3 SM visibility</b>
                  <em>HIGH ATTENTION</em>
                </div>
              )}
            </div>
            <div className="weather-storyline">
              <span><small>DEPART · TAMPA</small><b>5,500 FT</b><em>VFR · STEADY</em></span>
              <i>→</i>
              <span><small>EN ROUTE · CROSS CITY</small><b>2,800 FT</b><em>MVFR · LOWERING</em></span>
              <i>→</i>
              <span><small>ARRIVE · TALLAHASSEE</small><b>900 FT</b><em>IFR · DETERIORATING</em></span>
            </div>
            <div className="legend">
              <span>
                <i className="vfr" />
                VFR
              </span>
              <span>
                <i className="mvfr" />
                MVFR
              </span>
              <span>
                <i className="ifr" />
                IFR
              </span>
              <span className="source">
                {mode === "live"
                  ? "Airport labels: live AWC · advisory: scenario"
                  : "Scenario data, timestamped for judging"}
              </span>
            </div>
            {showLiveComparison && liveContext && (
              <div className="live-source-panel">
                <div className="live-source-head">
                  <span>LIVE SOURCE CHECK</span>
                  <b>{formatObserved(liveContext.checkedAt)}</b>
                </div>
                <p>
                  Live reports are shown separately from the reproducible
                  deterioration scenario. They do not validate the scenario.
                </p>
                <div className="live-source-grid">
                  {demoRoute.stations.map((id) => {
                    const report = liveReportsById[id];
                    const scenarioCategory = airports[id].category;
                    const liveCategory = report?.fltCat || "NO REPORT";
                    const categoryChanged = scenarioCategory !== liveCategory;
                    const ageHours = report?.reportTime
                      ? (Date.now() - new Date(report.reportTime).getTime()) /
                        3600000
                      : Infinity;
                    return (
                      <article
                        key={id}
                        className={categoryChanged ? "changed" : "unchanged"}
                      >
                        <div className="source-airport">
                          <span>{id}</span>
                          <b className={categoryClass(liveCategory)}>
                            {liveCategory}
                          </b>
                        </div>
                        <strong>
                          SCENARIO {scenarioCategory} → LIVE {liveCategory}
                        </strong>
                        <small>{formatObserved(report?.reportTime)}</small>
                        <em className={ageHours > 2 ? "stale" : ""}>
                          {ageHours > 2 ? "STALE REPORT" : "CURRENT REPORT"}
                        </em>
                      </article>
                    );
                  })}
                </div>
                <small className="live-source-boundary">
                  Source: Aviation Weather Center API. Obtain an official
                  briefing before flight. Browser cache: 15 minutes. Edge cache:
                  60 seconds.
                </small>
              </div>
            )}
          </div>
        </section>

        <section className="flight-strip process-strip" id="route">
          <article>
            <strong>1</strong>
            <span><small>ASK ONCE</small><b>What changed ahead?</b></span>
          </article>
          <article>
            <strong>2</strong>
            <span><small>WEBMCP DOUBLE-CHECKS</small><b>Route, limits, weather, sources</b></span>
          </article>
          <article>
            <strong>3</strong>
            <span><small>PILOT DECIDES</small><b>One concise, validated picture</b></span>
          </article>
          <button
            onClick={() =>
              document
                .querySelector("#ai-route-check")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            ASK THE AI <span>→</span>
          </button>
        </section>

        <section className="ai-console" id="ai-route-check">
          <div className="ai-intro">
            <p className="eyebrow">LIVE FREE AI + NATIVE WEBMCP</p>
            <h2>
              Ask naturally.
              <br />
              Watch every tool.
            </h2>
            <p>
              A Groq-hosted open-weight model interprets the request and chooses
              from an allowlisted set of site tools. The website supplies the
              weather evidence. The model cannot invent reports or authorize the
              flight.
            </p>
            <div className="ai-route-plan">
              <div className="route-plan-head">
                <span>ROUTE BEING CHECKED</span>
                <b>SEP 2 · 6:00 PM ET</b>
              </div>
              <div className="route-plan-track">
                {demoRoute.stations.map((id, index) => (
                  <React.Fragment key={id}>
                    <div
                      className={`route-plan-stop ${categoryClass(airports[id].category)}`}
                    >
                      <i />
                      <span>
                        <b>{id}</b>
                        <small>{airports[id].city}</small>
                        <em>{airports[id].category}</em>
                      </span>
                    </div>
                    {index < demoRoute.stations.length - 1 && (
                      <div className="route-plan-leg">
                        <span>{index === 0 ? "83 NM" : "91 NM"}</span>
                        <i />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
              <footer>
                <span>VFR · C172 · VFR-ONLY PILOT</span>
                <b>EXPECTED PATH: VFR → MVFR → IFR</b>
              </footer>
            </div>
            <label>
              PILOT REQUEST
              <textarea
                value={aiRun.prompt}
                onChange={(event) =>
                  setAiRun((current) => ({
                    ...current,
                    prompt: event.target.value,
                  }))
                }
              />
            </label>
            <button
              onClick={runAiDemo}
              disabled={
                aiRun.status === "planning" || aiRun.status === "executing"
              }
            >
              {aiRun.status === "planning"
                ? "THE AI IS PLANNING..."
                : aiRun.status === "executing"
                  ? "RUNNING WEBMCP TOOLS..."
                  : "RUN LIVE AI DEMO"}{" "}
              <span>→</span>
            </button>
          </div>
          <div className="agent-terminal">
            <div className="terminal-head">
              <span>
                <i /> AI AGENT SESSION
              </span>
              <b>
                {aiRun.model ? aiRun.model.replace("nvidia/", "") : "READY"}
              </b>
            </div>
            <div className="conversation">
              <div className="pilot-bubble">
                <small>PILOT</small>
                <p>{aiRun.prompt}</p>
              </div>
              {aiRun.status !== "idle" && (
                <div className="ai-bubble">
                  <small>GROQ OPEN-WEIGHT MODEL · NATURAL-LANGUAGE PLAN</small>
                  <p>
                    {aiRun.status === "planning"
                      ? "Interpreting the route request and selecting site-owned tools..."
                      : aiRun.message}
                  </p>
                </div>
              )}
            </div>
            <div className="tool-run">
              {aiRun.plan.length ? (
                aiRun.plan.map((name, index) => (
                  <div
                    key={name}
                    className={
                      index < aiRun.active
                        ? "done"
                        : index === aiRun.active
                          ? "active"
                          : ""
                    }
                  >
                    <span>
                      {index < aiRun.active
                        ? "✓"
                        : index === aiRun.active
                          ? "→"
                          : "·"}
                    </span>
                    <b>{name}</b>
                    <em>
                      {index < aiRun.active
                        ? "RESULT IN SHARED UI"
                        : index === aiRun.active
                          ? "EXECUTING"
                          : "QUEUED"}
                    </em>
                  </div>
                ))
              ) : (
                <p>Tool calls will appear here in execution order.</p>
              )}
            </div>
            {aiRun.status === "complete" && (
              <div className="ai-outcome">
                <div className="ai-outcome-head">
                  <span>ROUTE CHECK OUTCOME</span>
                  <b className="high">{assessment?.level || "REVIEW"}</b>
                </div>
                <h3>
                  {assessment?.headline ||
                    "The requested WebMCP checks completed."}
                </h3>
                <p>
                  {assessment?.worstCondition ||
                    "Review the structured results below before making a decision."}
                </p>
                {assessment?.factors?.length > 0 && (
                  <ul>
                    {assessment.factors.map((factor) => (
                      <li key={factor}>{factor}</li>
                    ))}
                  </ul>
                )}
                <div className="ai-outcome-next">
                  <b>NEXT REVIEW</b>
                  <span>
                    {assessment?.recommendation ||
                      "Inspect the evidence and official sources."}
                  </span>
                </div>
                {validatedAlert?.validated && (
                  <div className="ai-validation">
                    ✓ SECOND PAIR OF EYES VALIDATED THE DEMO ALERT
                  </div>
                )}
                <footer>
                  <strong>PILOT DECISION REQUIRED</strong>
                  <span>
                    {aiRun.usage?.total_tokens
                      ? `${aiRun.usage.total_tokens} model tokens`
                      : "deterministic fallback used"}
                  </span>
                </footer>
              </div>
            )}
            {aiRun.error && (
              <div className="ai-error">
                Free model unavailable: {aiRun.error}
              </div>
            )}
          </div>
        </section>

        <section className="case-studies" id="case-studies">
          <div className="case-studies-head">
            <div>
              <p className="eyebrow">WHY A SECOND PAIR OF EYES MATTERS</p>
              <h2>The threat is not missing data. It is missing the moment.</h2>
            </div>
            <p>
              Crews already have radar, dispatch, ATC, forecasts, procedures,
              and experience. These investigations show that the picture can
              still change faster than one display or one mental model. IMC
              Guardian is designed as a challenge layer, not a confirmation
              machine.
            </p>
          </div>
          <div className="case-study-grid">
            {caseStudies.map((study, index) => (
              <article className={index === 0 ? "featured" : ""} key={study.flight}>
                <header>
                  <span>{study.year} · {study.label}</span>
                  <b>0{index + 1}</b>
                </header>
                <h3>{study.flight}</h3>
                <small>{study.route}</small>
                <h4>{study.headline}</h4>
                <p>{study.detail}</p>
                <div className="case-lesson">
                  <span>WHAT THIS TEACHES THE PRODUCT</span>
                  <b>{study.lesson}</b>
                </div>
                <a href={study.href} target="_blank" rel="noreferrer">
                  {study.source} <span>↗</span>
                </a>
              </article>
            ))}
          </div>
          <div className="future-data-bridge">
            <div className="future-copy">
              <p className="eyebrow">FUTURE COMMERCIAL DATA BRIDGE</p>
              <h2>“Guardian, what do you see?”</h2>
              <p>
                A pilot should be able to ask one question and get the
                disagreement, not another wall of instruments. With a
                commercial aircraft feed and an approved onboard data path,
                WebMCP could compare where the aircraft reports it is, where it
                is headed, what altitude sources report, and what weather sits
                ahead.
              </p>
              <strong>Expose the disagreement fast. Let the pilot fly the airplane.</strong>
            </div>
            <div className="signal-stack">
              <div><span>01</span><b>POSITION</b><small>Latitude, longitude, route progress</small></div>
              <div><span>02</span><b>ALTITUDE</b><small>Pressure altitude vs. GPS geometric altitude</small></div>
              <div><span>03</span><b>MOTION</b><small>Ground track, groundspeed, vertical trend</small></div>
              <div><span>04</span><b>WEATHER AHEAD</b><small>Clouds, turbulence, ceilings, advisories</small></div>
              <div className="signal-warning"><span>!</span><b>AIRSPEED BOUNDARY</b><small>ADS-B does not report pitot-derived airspeed. Aircraft integration is required.</small></div>
            </div>
            <footer>
              <span>FAA: ADS-B OUT BROADCASTS CORE DATA ABOUT ONCE PER SECOND</span>
              <a href="https://www.faa.gov/air_traffic/technology/equipadsb/resources/faq" target="_blank" rel="noreferrer">VERIFY THE DATA BOUNDARY ↗</a>
            </footer>
          </div>
          <p className="case-boundary">
            These investigations define the problem space. IMC Guardian does
            not claim it would have prevented any event, and the prototype is
            not an official briefing or certified aircraft system.
          </p>
        </section>

        <section className="evidence" id="evidence">
          <div className="section-title">
            <p className="eyebrow">ONE ROUTE. EVERY SIGNAL.</p>
            <h2>Weather evidence the agent can actually read.</h2>
            <p>
              Structured WebMCP tools expose airport conditions, forecast
              trends, route advisories, alternates, and provenance without
              asking an agent to scrape the screen.
            </p>
          </div>
          <div className="condition-grid">
            {demoRoute.stations.map((id, index) => (
              <article key={id} className="condition">
                <div className="condition-top">
                  <span>
                    {index === 0
                      ? "ORIGIN"
                      : index === 2
                        ? "DESTINATION"
                        : "EN ROUTE"}
                  </span>
                  <b className={categoryClass(airports[id].category)}>
                    {airports[id].category}
                  </b>
                </div>
                <h3>{id}</h3>
                <p>{airports[id].name}</p>
                <code className="raw-metar">{observations[id].raw}</code>
                <div className="numbers">
                  <span>
                    <small>CEILING AGL</small>
                    <b>{airports[id].ceiling.toLocaleString()} FT</b>
                  </span>
                  <span>
                    <small>VISIBILITY</small>
                    <b>{airports[id].visibility} SM</b>
                  </span>
                  <span>
                    <small>SURFACE WIND</small>
                    <b>{airports[id].wind}</b>
                  </span>
                  <span>
                    <small>OBSERVED</small>
                    <b>2153Z</b>
                  </span>
                </div>
                <div className="taf">
                  <small>TAF TREND</small>
                  <p>{forecasts[id]}</p>
                </div>
                <footer>
                  <i className={index ? "down" : ""} />
                  {index
                    ? "Deteriorating toward departure"
                    : "Conditions steady"}
                </footer>
              </article>
            ))}
          </div>
          <div className="advisory-strip">
            <span>G-AIRMET IFR</span>
            <b>VALID 2100Z–0300Z</b>
            <p>
              Ceilings below 1,000 FT and visibility below 3 SM forecast over
              the northern route corridor.
            </p>
            <em>FORECAST ADVISORY · VERIFY WITH OFFICIAL SOURCE</em>
          </div>
        </section>

        <section className="national-weather" id="national-weather">
          <div className="national-head">
            <div>
              <p className="eyebrow">
                APPLE WEATHERKIT · LIVE GLOBAL CONDITIONS
              </p>
              <h2>
                A living weather layer,
                <br />
                beyond one route.
              </h2>
            </div>
            <p>
              Apple WeatherKit samples current cloud cover, precipitation, wind,
              and temperature around the globe. This is a live environmental
              view, while Aviation Weather Center remains the source for flight
              categories and advisories.
            </p>
          </div>
          <div className="global-weather-map cesium-map-wrap">
            <CesiumWeatherGlobe samples={liveContext?.weatherSamples || []} />
          </div>
          <footer>
            <span>Weather data provided by Apple WeatherKit</span>
            <span>
              {liveContext
                ? `${liveContext.weatherSamples.length} LIVE GLOBAL POINTS · ${new Date(liveContext.appleAsOf).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                : "GLOBAL LAYER LOADS ON REQUEST"}
            </span>
          </footer>
          <div className="east-coast-corridor" id="tampa-jfk">
            <div className="corridor-head">
              <div>
                <p className="eyebrow">APPLE WEATHERKIT · LIVE ROUTE CORRIDOR</p>
                <h2>
                  Tampa to JFK,
                  <br />
                  weather changing ahead.
                </h2>
              </div>
              <p>
                WeatherKit samples current cloud cover, precipitation, wind,
                and temperature along nine points from Tampa to JFK. Aviation
                Weather Center data remains the source for flight categories
                and advisories.
              </p>
            </div>
            <div className="us-weather-map restored-corridor-map">
              <div className="usa-shape">EAST COAST</div>
              <div className="cloud-band band-one" />
              <div className="cloud-band band-two" />
              {(routeContext?.samples || []).map((sample) => (
                <div
                  className="weather-sample"
                  key={sample.name}
                  style={{
                    left: `${sample.x}%`,
                    top: `${sample.y}%`,
                    "--cloud": Math.max(0.16, sample.cloudCover || 0),
                  }}
                >
                  <i />
                  <span>
                    <b>{sample.name}</b>
                    <small>
                      {Math.round((sample.cloudCover || 0) * 100)}% cloud ·{" "}
                      {Math.round(sample.temperature)}°C
                    </small>
                  </span>
                </div>
              ))}
              <div className="flight-animation">
                <span className="plane">✈</span>
                <i />
                <b>KTPA → KJFK</b>
              </div>
              <div className="ai-callout">
                <small>SECOND PAIR OF EYES</small>
                <p>
                  “Conditions are changing farther north. Want me to keep
                  watching the Tampa to JFK corridor?”
                </p>
              </div>
              {!routeContext && (
                <button onClick={loadRouteContext} disabled={routeLoading}>
                  {routeLoading ? "LOADING LIVE ROUTE…" : "LOAD LIVE TAMPA → JFK WEATHER"}{" "}
                  <span>→</span>
                </button>
              )}
              {routeError && <div className="corridor-error">{routeError}</div>}
            </div>
            <footer>
              <span>Weather data provided by Apple WeatherKit</span>
              <span>
                {routeContext
                  ? `9 LIVE ROUTE POINTS · ${new Date(routeContext.samples[0]?.asOf).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                  : "LIVE ROUTE LOADS ON REQUEST · 1-HOUR CACHE"}
              </span>
            </footer>
          </div>
        </section>

        <section className="route-watch" id="route-watch">
          <div>
            <p className="eyebrow">DEMO NOTIFICATIONS · PILOT CONTROLLED</p>
            <h2>Stay ahead of a changing route.</h2>
            <p>
              IMC Guardian can monitor material changes to ceilings, visibility,
              advisories, and alternate conditions. Alerts remain short and
              defer to cockpit workload.
            </p>
            <div className="priority">
              <b>AVIATE</b>
              <span>Maintain aircraft control</span>
              <b>NAVIGATE</b>
              <span>Know position and intended path</span>
              <b>COMMUNICATE</b>
              <span>Use ATC or Flight Service as appropriate</span>
            </div>
          </div>
          <div className="watch-card">
            <div className="watch-head">
              <span>
                <i className={watching ? "on" : ""} /> SECOND PAIR OF EYES
              </span>
              <b>{watching ? "ACTIVE DEMO" : "OFF"}</b>
            </div>
            <label>
              TRIGGER WHEN
              <select defaultValue="ceiling">
                <option value="ceiling">
                  Ceiling crosses 1,500 FT threshold
                </option>
                <option value="category">Flight category worsens</option>
                <option value="visibility">
                  Visibility crosses 5 SM threshold
                </option>
                <option value="advisory">New advisory intersects route</option>
              </select>
            </label>
            <label>
              DELIVERY
              <div className="delivery">
                <button className="selected">IN APP</button>
                <button>BROWSER</button>
                <button>SMS LATER</button>
              </div>
            </label>
            <button className="watch-action" onClick={enableRouteWatch}>
              {watching
                ? "SECOND PAIR OF EYES ENABLED ✓"
                : "ENABLE A SECOND PAIR OF EYES"}
            </button>
            {alertVisible && (
              <div className="weather-alert">
                <div>
                  <span>DEMO ALERT · 2 MIN AGO</span>
                  <b>Validated: KTLH ceiling crossed your threshold</b>
                  <p>
                    700 FT is below your configured 1,500 FT threshold. The TAF
                    scenario and overlapping G-AIRMET IFR confirm the trend.
                  </p>
                </div>
                <strong>✓ DOUBLE-CHECKED BY WEBMCP</strong>
                <small>
                  Threshold crossing · TAF context · advisory context
                </small>
                <strong>AVIATION ATTENTION CUE</strong>
                <small>
                  Aviate first. Review when workload permits. Contact ATC or
                  Flight Service for operational information. This alert does
                  not direct a maneuver.
                </small>
              </div>
            )}
          </div>
        </section>

        <section className={`assessment ${assessment ? "revealed" : ""}`}>
          <div>
            <p className="eyebrow">EXPLAINABLE ROUTE ASSESSMENT</p>
            <h2>
              {assessment
                ? assessment.headline
                : "Ask once. Inspect every factor."}
            </h2>
            <p>
              {assessment
                ? assessment.recommendation
                : "The agent assembles evidence and alternatives, but it cannot clear the flight or make the pilot’s decision."}
            </p>
          </div>
          <div className="risk">
            <span>ROUTE RISK</span>
            <b>{assessment?.level || "PENDING"}</b>
            <small>
              {assessment ? "3 material factors found" : "Run the route check"}
            </small>
          </div>
          {assessment && (
            <ul>
              {assessment.factors.map((item) => (
                <li key={item}>
                  <i /> {item}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="decision" id="decision">
          <div className="decision-copy">
            <p className="eyebrow">HUMAN DECISION CHECKPOINT</p>
            <h2>
              The AI does not say
              <br />
              “safe to fly.”
            </h2>
            <p>
              It makes the pressure points visible, finds comparatively better
              options, and hands the decision back to the pilot.
            </p>
            <blockquote>
              “What changes if I delay, divert, or cancel?”
            </blockquote>
          </div>
          <div className="options">
            <h3>Options for the pilot to review</h3>
            <button
              className={decision === "delay" ? "selected" : ""}
              onClick={() => setDecision("delay")}
            >
              <span>01</span>
              <div>
                <b>Delay and reassess</b>
                <small>Keep the decision open while conditions update</small>
              </div>
              <em>LOWER EXPOSURE</em>
            </button>
            <button
              className={decision === "alternate" ? "selected" : ""}
              onClick={() => setDecision("alternate")}
            >
              <span>02</span>
              <div>
                <b>Review VFR alternates</b>
                <small>
                  {alternates.length || 3} nearby stations report VFR in this
                  scenario
                </small>
              </div>
              <em>COMPARE</em>
            </button>
            <button
              className={decision === "cancel" ? "selected" : ""}
              onClick={() => setDecision("cancel")}
            >
              <span>03</span>
              <div>
                <b>Cancel the flight</b>
                <small>Remove schedule pressure from the decision</small>
              </div>
              <em>AVAILABLE</em>
            </button>
            <button
              className="record"
              disabled={!decision}
              onClick={() =>
                invoke("record_pilot_decision", { choice: decision })
              }
            >
              {decision ? "Record my decision" : "Pilot choice required"}{" "}
              <span>→</span>
            </button>
          </div>
        </section>

        <section className="trace">
          <div>
            <p className="eyebrow">LIVE WEBMCP TRACE</p>
            <h2>See what the agent received.</h2>
          </div>
          <div className="trace-panel">
            <div className="trace-head">
              <span>
                <i /> DOCUMENT.MODELCONTEXT
              </span>
              <b>{state.events.length} CALLS</b>
            </div>
            {state.events.length ? (
              state.events
                .slice(-6)
                .reverse()
                .map((event, index) => (
                  <details key={`${event.name}-${index}`} open={index === 0}>
                    <summary>
                      <span>
                        {String(state.events.length - index).padStart(2, "0")}
                      </span>
                      <b>{event.name}</b>
                      <em>SUCCESS</em>
                    </summary>
                    <pre>{JSON.stringify(event.output, null, 2)}</pre>
                  </details>
                ))
            ) : (
              <div className="empty">
                Run the route demo to watch structured inputs and outputs move
                between the AI and the page.
              </div>
            )}
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <b>IMC GUARDIAN</b>
        <p>
          Prototype decision support. Always obtain an official weather briefing
          and exercise pilot-in-command judgment.
        </p>
        <span>Data capability: NOAA Aviation Weather Center</span>
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
