import { airports, demoRoute, forecasts, observations } from './scenario.js';
import { delta175Replay, delta175Verdict } from './incidentReplay.js';

const rank = { LIFR: 4, IFR: 3, MVFR: 2, VFR: 1 };

export function createGuardianEngine() {
  const state = { route: null, assessment: null, selectedAlternate: null, routeWatch: null, alert: null, incidentReplay: null, events: [] };
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
        case 'configure_route_watch':
          requireRoute();
          state.routeWatch = { active: true, trigger: input.trigger || 'ceiling_below_threshold', ceilingThresholdFt: input.ceilingThresholdFt || 1500, visibilityThresholdSm: input.visibilityThresholdSm || 5, delivery: input.delivery || 'in_app', scope: `${state.route.origin}-${state.route.destination}` };
          output = { ...state.routeWatch, status: 'demo_watch_active', limitation: 'Attention cue only. Monitoring is not guaranteed and does not replace official inflight weather sources.' }; break;
        case 'check_route_changes':
          requireRoute();
          state.alert = { id: 'DEMO-KTLH-001', severity: 'attention', changed: true, airport: 'KTLH', field: 'forecast_ceiling', threshold: `${state.routeWatch?.ceilingThresholdFt || 1500} FT`, previous: '1,200 FT', current: '700 FT temporarily', advisoryStillActive: 'G-AIRMET IFR', validationStatus: 'pending', pilotAction: null };
          output = { alert: state.alert, instruction: 'Aviate first. Review when workload permits. Contact ATC or Flight Service for operational information. This alert does not direct a maneuver.' }; break;
        case 'validate_weather_alert':
          if (!state.alert || input.alertId !== state.alert.id) throw new Error('A valid active alertId is required.');
          state.alert.validationStatus = 'validated_demo_evidence';
          output = { alertId: state.alert.id, validated: true, status: state.alert.validationStatus, checks: [{ check: 'threshold_crossing', result: '700 FT is below configured 1,500 FT ceiling threshold' }, { check: 'forecast_context', result: 'KTLH TAF scenario includes temporary 700 FT ceiling' }, { check: 'advisory_context', result: 'G-AIRMET IFR scenario remains active over the route corridor' }], provenance: ['KTLH TAF reproducible scenario', 'G-AIRMET IFR reproducible scenario'], limitation: 'Demo validation checks consistency between supplied scenario products. It is not an official briefing or operational guarantee.' }; break;
        case 'acknowledge_weather_alert':
          if (!state.alert || input.alertId !== state.alert.id) throw new Error('A valid active alertId is required.');
          output = { acknowledged: true, alertId: input.alertId, status: 'attention_cue_acknowledged', note: 'Acknowledgment does not resolve the weather condition or authorize a flight action.' }; break;
        case 'record_pilot_decision':
          if (!input.choice) throw new Error('A pilot choice is required.');
          output = { recorded: true, choice: input.choice, status: 'decision_logged', note: 'The application records the human decision but never authorizes or clears a flight.' }; break;
        case 'load_incident_replay':
          if (input.caseId && input.caseId !== delta175Replay.caseId) throw new Error('The requested incident replay is not available.');
          state.incidentReplay = delta175Replay;
          output = delta175Replay;
          break;
        case 'compare_incident_evidence':
          if (!state.incidentReplay) throw new Error('Load an incident replay before comparing its evidence.');
          output = {
            caseId: state.incidentReplay.caseId,
            verdict: delta175Verdict,
            compared: {
              crewConcern: state.incidentReplay.timeline.find(item => item.label === 'Concern stated'),
              recordedEvent: state.incidentReplay.observedEvent,
              finalFindings: state.incidentReplay.investigationFindings,
            },
            pilotAction: null,
            clearance: null,
          };
          break;
        case 'explain_replay_limits':
          output = {
            historical: true,
            operational: false,
            limitations: [
              'This is a structured reconstruction of a completed NTSB investigation, not a replay of certified live flight data.',
              'It tests whether WebMCP can expose and compare the documented evidence. It does not recreate what every system displayed second by second.',
              'It does not judge a pilot decision, direct a maneuver, issue a clearance, or prove a counterfactual outcome.',
              'IMC Guardian did not exist on this flight and cannot be claimed to have prevented the encounter.',
            ],
            source: delta175Replay.source,
          };
          break;
        default: throw new Error(`Unknown tool: ${name}`);
      }
      return record(name, input, output);
    }
  };
}
