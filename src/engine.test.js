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
});
