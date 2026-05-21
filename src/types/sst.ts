export interface AuthRouteHint {
  method: string;
  path: string;
  middleware?: string;
  limit_const?: string;
  test_override?: number;
}

export interface RuntimeProbeHints {
  emulator?: {
    functions_base_path?: string;
    region?: string;
    project_id?: string;
  };
  auth?: {
    protected_routes?: AuthRouteHint[];
    public_rate_limited_routes?: AuthRouteHint[];
  };
  db_rules?: {
    firestore_deny_paths?: string[];
    storage_deny_paths?: string[];
  };
}

export interface SecurityLayerEntry {
  name: string;
  layer: string;
  provider?: string;
  producer_file?: string;
  description?: string;
}

export interface ParsedSst {
  project: string;
  projectType?: string;
  sstVersion?: string;
  productName?: string;
  criticalContracts: string[];
  securityLayer: SecurityLayerEntry[];
  runtimeProbeHints: RuntimeProbeHints;
  repoRoot?: string;
  sstPath: string;
  rawYaml: Record<string, unknown>;
}
