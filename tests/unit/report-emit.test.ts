import { describe, expect, it } from 'vitest';
import { buildLaunchHeader, formatLaunchGateTitle } from '../../src/report-emit.js';
import type { ProbeResult } from '../../src/types/probe-result.js';

const emptyProbes: ProbeResult[] = [];

describe('formatLaunchGateTitle', () => {
  it('uses generic title when launch_gate is absent', () => {
    expect(formatLaunchGateTitle()).toBe('## Launch gate status');
    expect(formatLaunchGateTitle(undefined)).toBe('## Launch gate status');
  });

  it('includes name and date when launch_gate is present', () => {
    expect(formatLaunchGateTitle({ name: 'NHS', date: '2026-05-25' })).toBe(
      '## Launch gate status (NHS 2026-05-25)',
    );
  });
});

describe('buildLaunchHeader', () => {
  it('embeds parametric launch gate title in the section', () => {
    const header = buildLaunchHeader(emptyProbes, { name: 'NHS', date: '2026-05-25' });
    expect(header.startsWith('## Launch gate status (NHS 2026-05-25)')).toBe(true);
  });

  it('uses generic title when launch_gate is omitted', () => {
    const header = buildLaunchHeader(emptyProbes);
    expect(header.startsWith('## Launch gate status\n')).toBe(true);
    expect(header).not.toContain('(NHS');
  });
});
