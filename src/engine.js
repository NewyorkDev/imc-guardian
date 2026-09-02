import { airports, demoRoute, forecasts, observations } from './scenario.js';

const rank = { LIFR: 4, IFR: 3, MVFR: 2, VFR: 1 };

export function createGuardianEngine() {
  const state = { route: null, assessment: null, selectedAlternate: null, events: [] };
  const record = (name, input, output) => { state.events.push({ name, input, output, at: new Date().toISOString() }); return output; };
  const requireRoute = () => { if (!state.route) throw new Error('Set a route before requesting route-specific analysis.'); };
  return {
    state,
    run(name, input = {}) {
      let output;
      switch (name) {
        case 'set_flight_context':
          output = { status: 'context_set', route: { ...demoRoute, ...input }, safetyBoundary: 'Decision support only. Not a weather briefing, clearance, or go/no-go determination.' };
          state.route = output.route;
          break;
        case 'check_airport_conditions': {
          const ids = input.airportIds || state.route?.stations || [];
          output = { airports: ids.map(id => ({ id, ...airports[id], observation: observations[id], forecast: forecasts[id] })).filter(item => item.name), provenance: 'Scenario data for reproducible judging' };
          break;
        }
        case 'check_route_advisories':
          requireRoute(); output = { advisories: [state.route.advisory], intersectsRoute: true, note: 'Review the official source and obtain a complete briefing.' }; break;
        case 'assess_route_weather': {
          requireRoute();
          const routeAirports = state.route.stations.map(id => ({ id, ...airports[id] }));
          const worst = routeAirports.sort((a, b) => rank[b.category] - rank[a.category])[0];
          output = { level: 'HIGH', headline: 'Deteriorating VFR conditions along the northern route', worstCondition: `${worst.id} ${worst.category}: ${worst.ceiling} ft ceiling, ${worst.visibility} SM`, factors: ['Destination reported IFR', 'Ceilings deteriorate northbound', 'G-AIRMET IFR overlaps the route'], missing: ['Official pilot briefing', 'Pilot currency and personal minimums'], recommendation: 'Pause and review alternatives with an official weather briefing source. The pilot remains responsible for the decision.', goNoGo: null };
          state.assessment = output; break;
        }
        case 'find_safer_alternates':
          requireRoute(); output = { alternates: state.route.alternateIds.map(id => ({ id, ...airports[id], reason: `${airports[id].category}, ${airports[id].visibility} SM visibility` })), rankingBasis: 'Weather category first, then route proximity. Not an endorsement or landing-suitability determination.' }; break;
        case 'compare_route_options':
          requireRoute(); output = { options: [{ label: 'Continue as entered', risk: 'HIGH', reason: 'IFR destination and deteriorating route' }, { label: 'Delay and reassess', risk: 'LOWER', reason: 'Preserves the decision while conditions and forecasts are reviewed' }, { label: 'Choose a VFR alternate', risk: 'LOWER', reason: 'Three nearby stations currently report VFR in this scenario' }], preferred: null, requiresPilotChoice: true }; break;
        case 'explain_imc_risk':
          output = { plainLanguage: 'A VFR pilot can lose outside visual references when entering cloud or reduced visibility. Spatial disorientation can develop quickly. Forecasts and automated analysis have limitations.', action: 'Do not use this prototype as a substitute for an official briefing, ATC, a flight instructor, or pilot judgment.' }; break;
        case 'record_pilot_decision':
          if (!input.choice) throw new Error('A pilot choice is required.');
          output = { recorded: true, choice: input.choice, status: 'decision_logged', note: 'The application records the human decision but never authorizes or clears a flight.' }; break;
        default: throw new Error(`Unknown tool: ${name}`);
      }
      return record(name, input, output);
    }
  };
}
