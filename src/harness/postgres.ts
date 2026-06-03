/** Postgres Docker harness plug-in — availability gate for NH probes (no ORM in Auditor). */

export interface PostgresHarnessState {
  available: boolean;
  databaseUrl?: string;
}

export async function loadPostgresState(opts: {
  mockMode?: boolean;
  databaseUrl?: string;
}): Promise<PostgresHarnessState> {
  const url = opts.databaseUrl ?? process.env.NH_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) return { available: false };
  if (opts.mockMode ?? process.env.BR_RUNTIME_MOCK === '1') {
    return { available: true, databaseUrl: url };
  }
  return { available: false, databaseUrl: url };
}
