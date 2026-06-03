/** Read-only secret access plug-in (mock map or process env — mirrors emulator pepper resolution). */

import type { SecretManagerReadonly } from '../types/harness.js';

export type { SecretManagerReadonly };

export interface SecretManagerFactoryOptions {
  mockMode?: boolean;
  mockSecrets?: Record<string, string>;
}

export function createMockSecretManager(secrets: Record<string, string>): SecretManagerReadonly {
  return {
    async readSecret(name: string): Promise<string | undefined> {
      return secrets[name];
    },
  };
}

/** Local/prod: reads `process.env[secretName]`; mock mode uses injected map. */
export function loadSecretManager(opts: SecretManagerFactoryOptions): SecretManagerReadonly {
  if (opts.mockMode || process.env.BR_RUNTIME_MOCK === '1') {
    return createMockSecretManager(opts.mockSecrets ?? {});
  }
  return {
    async readSecret(name: string): Promise<string | undefined> {
      const v = process.env[name];
      return v && v.length > 0 ? v : undefined;
    },
  };
}
