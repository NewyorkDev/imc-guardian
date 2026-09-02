# IMC Guardian

## Elevator pitch

IMC Guardian lets a pilot ask AI to inspect a VFR route, explain deteriorating weather and compare alternatives through WebMCP while keeping every flight decision with the pilot.

Character count: 178

## About the project

IMC Guardian is an aviation weather decision-support prototype. A pilot can enter a proposed route and ask an AI to check the weather. Twelve WebMCP tools give the agent structured access to the route, airport observations, forecasts, advisories, risk factors, nearby alternates, validated route-watch notifications, and decision options.

The application does not tell a pilot that a flight is safe, issue a clearance, or replace an official weather briefing. It makes the evidence and pressure points easier to see so the pilot can make a more informed decision.

## Inspiration

The idea came from a simple question: what if AI could help a pilot see a bad weather decision forming before the airplane ever reaches the clouds?

VFR flight into instrument meteorological conditions remains a serious aviation risk. Weather information already exists, but it is spread across observations, forecasts, advisories, route geography, and pilot-specific limits. The opportunity with WebMCP is not to let an AI play pilot. It is to let the aviation website expose those facts as structured tools, let the AI do the repetitive comparison, and keep the real decision with the person flying the aircraft.

## What it does

For the reproducible demo, a VFR pilot proposes a flight from Tampa to Tallahassee. Conditions deteriorate along the northern part of the route, the destination reports IFR, and a G-AIRMET for IFR overlaps the corridor.

The agent can inspect the airport evidence, explain why the route risk increased, find three nearby airports reporting VFR in the scenario, and compare delaying, diverting, or canceling. It cannot select a preferred option for the pilot. The final tool records the pilot's explicit choice and clearly states that it does not authorize or clear the flight.

## How we built it

We built a React and Vite application with a deterministic aviation-risk engine and twelve imperative WebMCP tools registered through `document.modelContext.registerTool`. The user interface and the agent share the same route, assessment, alternatives, route watch, notifications, validation, decision, and live tool trace.

NOAA Aviation Weather Center is the aviation-data foundation. Because its API does not permit browser cross-origin requests, the project uses a scoped Vercel server-side proxy with caching and a custom user agent. Apple WeatherKit is wired as a second server-side source for supplemental general weather context such as precipitation, wind, visibility trends, and alerts. The WeatherKit signing credentials never enter the browser bundle.

An on-demand live corridor samples nine Apple WeatherKit points from Tampa to JFK and visualizes cloud cover, temperature, wind, precipitation, and changing conditions around an animated route. The endpoint is cached for 30 minutes so repeated visitors reuse the same Apple response instead of multiplying calls.

The frontend also includes a live natural-language agent demo using GPT-OSS 20B on Groq. The model interprets the pilot's sentence and chooses an ordered subset of allowlisted site tools. The browser executes those actual WebMCP tools and shows every step moving from queued to executing to shared UI state, along with model token usage. Weather facts come from the application tools and data sources, not the model's memory.

We also created a clearly labeled scenario mode. That makes the judging flow reproducible even when live weather changes or a source is temporarily unavailable. It never presents scenario values as live reports.

The pilot can enable Second Pair of Eyes, a focused demo route watch for a worsening flight category, a ceiling below a user-configured threshold, reduced visibility, or a new advisory intersecting the route. WebMCP exposes setup, change detection, validation, and acknowledgment as separate auditable tools. Before presenting the alert, the validation tool checks the threshold crossing against the TAF scenario and overlapping advisory context. The alert follows the cockpit priority of aviate, navigate, communicate and never directs a maneuver.

## Challenges

The hardest part was deciding what the system must not do. It is easy to make a dramatic aviation demo by having an AI say go or no-go. That would also be the wrong product. We designed the tools so they surface evidence and tradeoffs but return no flight clearance and no automated safety verdict.

The second challenge was data provenance. General weather is not the same thing as aviation weather. We use Aviation Weather Center products for aviation observations and advisories, while Apple WeatherKit provides a separate supplemental layer. The interface identifies scenario data, live sources, and limitations instead of blending them into one unsupported claim.

## What we learned

WebMCP is useful here because the important information is not a collection of buttons. It is a decision structure: aircraft and pilot context, route, conditions, trends, advisories, alternatives, missing information, and the human choice. Giving an agent named tools for those concepts is more reliable and auditable than asking it to scrape a weather map.

We also learned that a strong human checkpoint does not need to mean constant confirmation. The AI can collect and compare the repetitive evidence in one pass. It stops at the one place where human authority matters most: the flight decision.

## Where we see it going

The next version would connect live aircraft data from AirNav Business or FlightRadar24. That would add position, altitude, speed, heading, and destination context. Combined with Aviation Weather Center products and Apple WeatherKit, IMC Guardian could estimate how long an aircraft has before reaching deteriorating conditions and show viable airports behind, ahead, or beside the route.

That integration currently carries an additional commercial API cost, so we did not pretend to include it in this prototype. The architecture is ready for that layer, and the competition build proves the harder interaction model: aircraft context to route to weather ahead to trends to alternatives to an explicit human decision.

Longer term, the same approach could support pilot-defined personal minimums, instructor-reviewed profiles, post-flight decision review, and alerts designed around plan-continuation bias. Any operational version would require aviation-domain review, rigorous validation, reliable data redundancy, and careful regulatory and liability analysis.

## Built with

WebMCP imperative API, React, JavaScript, HTML, CSS, Vite, Vitest, Playwright, Node.js, Vercel Functions, NOAA Aviation Weather Center API, Apple WeatherKit, Groq, GPT-OSS 20B, JSON Web Tokens, GitHub, Vercel
