import type { ParsedSst } from '../types/sst.js';

export interface BlockedCallRecord {
  url: string;
  method: string;
  at: string;
}

export interface NetworkMockPlugin {
  wrapFetch(base: typeof fetch): typeof fetch;
  getBlockedCallLog(): BlockedCallRecord[];
  reset(): void;
  assertZeroBlockedCalls(): { ok: boolean; log: BlockedCallRecord[] };
}

export interface SecretManagerReadonly {
  readSecret(name: string): Promise<string | undefined>;
}

export interface EmulatorConfig {
  authPort: number;
  firestorePort: number;
  functionsPort: number;
  storagePort: number;
  projectId: string;
  region: string;
  functionsBasePath: string;
}

export interface HarnessContext {
  sst: ParsedSst;
  emulator: EmulatorConfig;
  mockMode: boolean;
  fetchFn: typeof fetch;
  networkMock?: NetworkMockPlugin;
  secretManager?: SecretManagerReadonly;
  postgresAvailable?: boolean;
}

export interface HarnessPlugin {
  id: string;
  boot(): Promise<void>;
  teardown(): Promise<void>;
  healthCheck(): Promise<boolean>;
  getContext(): HarnessContext;
}

export interface HarnessFactoryOptions {
  sst: ParsedSst;
  repoRoot?: string;
  mockMode?: boolean;
  fetchFn?: typeof fetch;
}
