import { describe, expect, it } from 'vitest';
import { loadRoutingTable, routeContract } from '../../src/routing.js';

describe('routing-table', () => {
  it('routes IGV firestore contract to db-rules-deny', () => {
    const route = routeContract('firestore-deny-all-client-reads');
    expect(route.probe).toBe('db-rules-deny');
  });

  it('routes structural contracts to structural-deferred GREEN', () => {
    const route = routeContract('region-europe-west2');
    expect(route.probe).toBe('structural-deferred');
    expect(route.verdict).toBe('GREEN');
  });

  it('routes unknown contract to AMBER catch-all', () => {
    const route = routeContract('totally-unknown-contract-xyz');
    expect(route.verdict).toBe('AMBER');
  });

  it('has explicit rows for all known contracts (no catch-all needed in fixtures)', () => {
    const table = loadRoutingTable();
    const explicit = table.rules.filter((r) => r.contract !== '*');
    expect(explicit.length).toBeGreaterThanOrEqual(34);
  });
});
