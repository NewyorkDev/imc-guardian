export const toolDefinitions = [
  ['set_flight_context', 'Set a proposed flight route, departure time, operating rules, aircraft, and pilot constraints. This does not assess or authorize the flight.', { origin: { type: 'string' }, destination: { type: 'string' }, departure: { type: 'string' }, rules: { type: 'string', enum: ['VFR', 'IFR'] }, aircraft: { type: 'string' }, pilot: { type: 'string' } }, ['origin', 'destination', 'departure', 'rules']],
  ['check_airport_conditions', 'Read structured observations and forecasts for airports relevant to the proposed flight. This never makes a go or no-go decision.', { airportIds: { type: 'array', items: { type: 'string' }, maxItems: 10 } }, []],
  ['check_route_advisories', 'Check weather advisories intersecting the entered route and return provenance and limitations.', {}, []],
  ['assess_route_weather', 'Combine route conditions into an explainable risk summary. Returns no clearance and no go or no-go command.', {}, []],
  ['find_safer_alternates', 'Find nearby airports with comparatively better reported conditions. Results do not establish airport or landing suitability.', {}, []],
  ['compare_route_options', 'Compare continuing, delaying, or choosing an alternate and require the pilot to make the decision.', {}, []],
  ['explain_imc_risk', 'Explain VFR into IMC and spatial-disorientation risk in plain language with strong limitations.', {}, []],
  ['configure_route_watch', 'Configure a demo route watch for material weather changes. This is an attention aid, not guaranteed monitoring or an operational flight service.', { trigger: { type: 'string', enum: ['flight_category_worsens', 'ceiling_below_minimum', 'new_route_advisory'] }, delivery: { type: 'string', enum: ['in_app', 'browser'] } }, ['trigger']],
  ['check_route_changes', 'Check the watched route for a material scenario change and return evidence, source context, and a workload-aware attention cue. This never directs a maneuver.', {}, []],
  ['acknowledge_weather_alert', 'Acknowledge that a displayed weather attention cue was seen. This does not resolve the condition or authorize a flight action.', { alertId: { type: 'string' } }, ['alertId']],
  ['record_pilot_decision', 'Record the pilot’s explicit choice for the demo. This never authorizes, dispatches, files, or clears a flight.', { choice: { type: 'string', enum: ['delay', 'alternate', 'cancel', 'continue_after_official_briefing'] } }, ['choice']]
];

export async function installWebMcp(engine, onUpdate) {
  window.__IMC_GUARDIAN__ = { tools: toolDefinitions.map(([name]) => name), invoke: (name, input) => { const result = engine.run(name, input); onUpdate?.(); return result; } };
  if (!document.modelContext?.registerTool) return 0;
  for (const [name, description, properties, required] of toolDefinitions) {
    await document.modelContext.registerTool({ name, description, inputSchema: { type: 'object', properties, required }, execute: input => { const result = engine.run(name, input); onUpdate?.(); return { content: [{ type: 'text', text: JSON.stringify(result) }] }; } });
  }
  return toolDefinitions.length;
}
