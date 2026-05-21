import type { ParsedSst } from '../types/sst.js';

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
