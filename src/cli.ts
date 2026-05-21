#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadHarness } from './harness/index.js';
import { runTrancheAProbes } from './probes/index.js';
import { buildRoutingCoverage } from './routing.js';
import { emitReport, writeReportPath } from './report-emit.js';
import { parseSstFile } from './sst-reader.js';

const VERSION = '0.1.0';

function parseArgs(argv: string[]) {
  let sstPath = '';
  let repoRoot: string | undefined;
  let probeFilter: string | undefined;
  let emulatorOnly = false;
  let mockMode = process.env.BR_RUNTIME_MOCK === '1';
  const deterministic = process.env.BR_RUNTIME_DETERMINISTIC === '1';

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--emulator-only') emulatorOnly = true;
    else if (arg === '--mock') mockMode = true;
    else if (arg.startsWith('--target=')) repoRoot = arg.slice('--target='.length);
    else if (arg.startsWith('--probe=')) probeFilter = arg.slice('--probe='.length);
    else if (arg.startsWith('--repo-root=')) repoRoot = arg.slice('--repo-root='.length);
    else if (!arg.startsWith('-')) sstPath = arg;
  }

  return { sstPath, repoRoot, probeFilter, emulatorOnly, mockMode, deterministic };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (!args.sstPath) {
    console.error(
      'Usage: br-runtime <sst-path> [--target=<repo-root>] [--probe=<id>] [--emulator-only] [--mock]',
    );
    process.exit(1);
  }

  const sstPath = resolve(args.sstPath);
  const sst = parseSstFile(sstPath, args.repoRoot);
  const harness = loadHarness({
    sst,
    repoRoot: args.repoRoot ?? sst.repoRoot,
    mockMode: args.mockMode,
  });

  try {
    await harness.boot();
    const ctx = harness.getContext();
    const probeResults = await runTrancheAProbes(ctx, sst.criticalContracts, args.probeFilter);
    const routingCoverage = buildRoutingCoverage(sst.criticalContracts);
    const report = emitReport({
      sst,
      probeResults,
      routingCoverage,
      auditorVersion: VERSION,
      deterministic: args.deterministic,
    });

    const outPath = writeReportPath(sstPath);
    writeFileSync(outPath, report, 'utf8');
    console.log(`Report written: ${outPath}`);
    console.log(`Overall: ${probeResults.some((p) => p.verdict === 'RED') ? 'RED' : 'see report'}`);
  } finally {
    await harness.teardown();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
