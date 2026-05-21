import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HarnessContext, HarnessFactoryOptions, HarnessPlugin } from '../types/harness.js';
import type { ParsedSst } from '../types/sst.js';

const DEFAULT_PORTS = { auth: 9099, firestore: 8080, functions: 5001, storage: 9199 };

function readFirebaseJson(repoRoot: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(join(repoRoot, 'firebase.json'), 'utf8')) as Record<
      string,
      unknown
    >;
  } catch {
    return undefined;
  }
}

function resolveEmulatorConfig(sst: ParsedSst, repoRoot?: string) {
  const hints = sst.runtimeProbeHints.emulator ?? {};
  const firebase = repoRoot ? readFirebaseJson(repoRoot) : undefined;
  const emulators = (firebase?.emulators ?? {}) as Record<string, { port?: number }>;
  return {
    authPort: emulators.auth?.port ?? DEFAULT_PORTS.auth,
    firestorePort: emulators.firestore?.port ?? DEFAULT_PORTS.firestore,
    functionsPort: emulators.functions?.port ?? DEFAULT_PORTS.functions,
    storagePort: emulators.storage?.port ?? DEFAULT_PORTS.storage,
    projectId: hints.project_id ?? 'demo-runtime-audit',
    region: hints.region ?? 'europe-west2',
    functionsBasePath: hints.functions_base_path ?? 'api',
  };
}

async function portOpen(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(500) });
    return res.status > 0;
  } catch {
    return false;
  }
}

export class FirebaseHarness implements HarnessPlugin {
  readonly id = 'firebase-emulator';
  private ctx!: HarnessContext;

  constructor(private readonly opts: HarnessFactoryOptions) {}

  async boot(): Promise<void> {
    const mockMode = this.opts.mockMode ?? process.env.BR_RUNTIME_MOCK === '1';
    const emulator = resolveEmulatorConfig(this.opts.sst, this.opts.repoRoot);
    this.ctx = {
      sst: this.opts.sst,
      emulator,
      mockMode,
      fetchFn: this.opts.fetchFn ?? fetch,
    };
    if (mockMode) return;
    const up = await portOpen(emulator.functionsPort);
    if (!up) {
      throw new Error(
        `Firebase emulator not reachable on port ${emulator.functionsPort}. ` +
          'Start with: firebase emulators:start --only auth,firestore,functions,storage',
      );
    }
  }

  async teardown(): Promise<void> {
    /* stateless attach — no teardown */
  }

  async healthCheck(): Promise<boolean> {
    if (this.ctx.mockMode) return true;
    return portOpen(this.ctx.emulator.functionsPort);
  }

  getContext(): HarnessContext {
    return this.ctx;
  }
}

export function loadHarness(opts: HarnessFactoryOptions): HarnessPlugin {
  return new FirebaseHarness(opts);
}

export function functionsUrl(ctx: HarnessContext, path: string): string {
  const { emulator } = ctx;
  const base = `http://127.0.0.1:${emulator.functionsPort}/${emulator.projectId}/${emulator.region}/${emulator.functionsBasePath}`;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
