import { describe, expect, it } from 'vitest';
import { createGuardianEngine } from './engine.js';

describe('IMC Guardian engine', () => {
  it('requires route context for route assessment', () => {
    expect(() => createGuardianEngine().run('assess_route_weather')).toThrow(/Set a route/);
  });
  it('identifies the scenario risk without issuing a go or no-go decision', () => {
    const engine = createGuardianEngine();
    engine.run('set_flight_context', { origin: 'KTPF', destination: 'KTLH', departure: '2026-09-02T18:00:00-04:00', rules: 'VFR' });
    const result = engine.run('assess_route_weather');
    expect(result.level).toBe('HIGH');
    expect(result.goNoGo).toBeNull();
    expect(result.factors).toContain('Destination reported IFR');
  });
  it('requires an explicit pilot choice', () => {
    const engine = createGuardianEngine();
    expect(() => engine.run('record_pilot_decision')).toThrow(/choice is required/);
    expect(engine.run('record_pilot_decision', { choice: 'delay' }).choice).toBe('delay');
  });
  it('keeps route-watch alerts informational and acknowledgeable', () => {
    const engine = createGuardianEngine();
    engine.run('set_flight_context', { origin: 'KTPF', destination: 'KTLH', departure: '2026-09-02T18:00:00-04:00', rules: 'VFR' });
    expect(engine.run('configure_route_watch', { trigger: 'ceiling_below_threshold', ceilingThresholdFt: 1500 }).active).toBe(true);
    const change = engine.run('check_route_changes');
    expect(change.alert.pilotAction).toBeNull();
    expect(engine.run('validate_weather_alert', { alertId: change.alert.id }).validated).toBe(true);
    expect(engine.run('acknowledge_weather_alert', { alertId: change.alert.id }).acknowledged).toBe(true);
  });
  it('supports the documented Delta 175 concern without judging pilot action', () => {
    const engine = createGuardianEngine();
    const replay = engine.run('load_incident_replay', { caseId: 'delta-175-2023' });
    expect(replay.source.report).toBe('DCA23FA428 Final Report');
    const comparison = engine.run('compare_incident_evidence');
    expect(comparison.verdict.concernSupported).toBe(true);
    expect(comparison.verdict.actionJudgment).toBeNull();
    expect(comparison.pilotAction).toBeNull();
    expect(comparison.clearance).toBeNull();
    expect(comparison.verdict.notSupported).toMatch(/does not establish/);
    expect(engine.run('explain_replay_limits').operational).toBe(false);
  });
});
