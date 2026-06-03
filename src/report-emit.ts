import type { ProbeResult, RoutingCoverage, Verdict } from './types/probe-result.js';
import type { LaunchGate, ParsedSst } from './types/sst.js';

export interface ReportOptions {
  sst: ParsedSst;
  probeResults: ProbeResult[];
  routingCoverage: RoutingCoverage[];
  auditorVersion: string;
  timestamp?: string;
  deterministic?: boolean;
}

function worstVerdict(verdicts: Verdict[]): Verdict {
  const order: Verdict[] = ['RED', 'AMBER', 'DEFERRED', 'SKIPPED', 'GREEN'];
  for (const v of order) {
    if (verdicts.includes(v)) return v;
  }
  return 'GREEN';
}

function formatRoutingStatus(r: RoutingCoverage): string {
  if (!r.routed) return `AMBER — ${r.note ?? 'unrouted'}`;
  if (r.verdict === 'DEFERRED') return `DEFERRED — ${r.note ?? 'manual runbook'}`;
  return 'routed';
}

function formatSubProbes(result: ProbeResult): string {
  if (!result.subProbes.length) return '_No sub-probes._\n';
  const rows = result.subProbes.map(
    (s) => `| ${s.id} | ${s.verdict} | ${s.detail.replace(/\|/g, '\\|')} | ${s.citation ?? '—'} |`,
  );
  return ['| Sub-probe | Verdict | Detail | Citation |', '|---|---|---|---|', ...rows, ''].join(
    '\n',
  );
}

function formatEvidence(result: ProbeResult): string {
  return result.evidence
    .map((e) => {
      const parts = [`- ${e.summary}`];
      if (e.citation) parts.push(`  - Citation: \`${e.citation}\``);
      if (e.command) parts.push(`  - Re-run: \`${e.command}\``);
      return parts.join('\n');
    })
    .join('\n');
}

export function formatLaunchGateTitle(launchGate?: LaunchGate): string {
  if (launchGate?.name && launchGate?.date) {
    return `## Launch gate status (${launchGate.name} ${launchGate.date})`;
  }
  return '## Launch gate status';
}

export function buildLaunchHeader(probeResults: ProbeResult[], launchGate?: LaunchGate): string {
  const deferred = probeResults.filter((p) => p.verdict === 'DEFERRED');
  const lines = [formatLaunchGateTitle(launchGate), ''];
  if (deferred.length === 0) {
    lines.push('All Tranche A runtime probes executed — no deferrals.');
  } else {
    lines.push('**Visible deferrals (Anthony fork decisions recorded):**', '');
    for (const d of deferred) {
      lines.push(`- **${d.probeName}** — ${d.verdict}: ${d.note ?? d.evidence[0]?.summary ?? ''}`);
    }
    lines.push('');
    lines.push(
      '> Probe 7b (real Cloud Storage bucket prefix scan) is **DEFERRED** to the product manual runbook §Check 7 — one-time pre-launch check before 2026-05-25. Auditor delivers Probe 7a (storage-rules-deny via emulator) only.',
    );
  }
  return lines.join('\n');
}

export function emitReport(opts: ReportOptions): string {
  const ts = opts.deterministic
    ? '1970-01-01T00:00:00.000Z'
    : (opts.timestamp ?? new Date().toISOString());
  const overall = worstVerdict(opts.probeResults.map((p) => p.verdict));
  const unrouted = opts.routingCoverage.filter((r) => !r.routed);

  const sections = [
    '# BR Runtime Audit Report',
    '',
    `**Product:** ${opts.sst.project}`,
    `**Run timestamp:** ${ts}`,
    `**Auditor version:** ${opts.auditorVersion}`,
    `**SST path:** \`${opts.sst.sstPath}\``,
    `**Overall verdict:** ${overall}`,
    '',
    buildLaunchHeader(opts.probeResults, opts.sst.launchGate),
    '',
    '## Routing coverage',
    '',
    unrouted.length === 0
      ? 'All critical_contracts entries routed (zero AMBER unrouted).'
      : `**${unrouted.length} unrouted contract(s):** ${unrouted.map((u) => u.contract).join(', ')}`,
    '',
    '| Contract | Probe | Status |',
    '|---|---|---|',
    ...opts.routingCoverage.map(
      (r) => `| ${r.contract} | ${r.probe} | ${formatRoutingStatus(r)} |`,
    ),
    '',
    '## Probe results',
    '',
  ];

  for (const result of opts.probeResults) {
    sections.push(
      `### ${result.probeName} (\`${result.probeId}\`)`,
      '',
      `**Verdict:** ${result.verdict}`,
      result.note ? `\n**Note:** ${result.note}\n` : '',
      formatSubProbes(result),
      '**Evidence:**',
      formatEvidence(result),
      '',
    );
  }

  return sections.join('\n');
}

export function writeReportPath(sstPath: string): string {
  const parts = sstPath.replace(/\\/g, '/').split('/');
  parts[parts.length - 1] = 'br-runtime-report.md';
  return parts.join('/');
}
