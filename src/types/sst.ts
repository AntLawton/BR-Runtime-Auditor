export interface AuthRouteHint {
  method: string;
  path: string;
  middleware?: string;
  limit_const?: string;
  test_override?: number;
}

export interface LaunchGate {
  name: string;
  date: string;
}

export interface AiPromptSurfaceHint {
  id: string;
  producer_file: string;
  block_marker?: string;
  golden_file?: string;
}

export interface CsprngHint {
  spine_id: string;
  producer_file?: string;
  sample_module?: string;
}

export interface DistinctSecretPair {
  a: string;
  b: string;
}

export interface PrivacyThresholdHint {
  name: string;
  value: number;
  producer_file?: string;
  /** Module exporting shouldSurfaceAggregate(groupSize, thresholdName) — product aggregation output. */
  aggregation_module?: string;
}

export interface SpineEntry {
  id: string;
  producerFile?: string;
  blockMarker?: string;
}

export interface EnvVarContractEntry {
  name: string;
  description?: string;
}

export interface RuntimeProbeHints {
  launch_gate?: LaunchGate;
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
    postgres_deny_queries?: string[];
  };
  ai_prompt_surfaces?: AiPromptSurfaceHint[];
  csprng?: CsprngHint[];
  distinct_secret_pairs?: DistinctSecretPair[];
  privacy_thresholds?: PrivacyThresholdHint[];
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
  spine: SpineEntry[];
  envVarContract: EnvVarContractEntry[];
  runtimeProbeHints: RuntimeProbeHints;
  launchGate?: LaunchGate;
  repoRoot?: string;
  sstPath: string;
  rawYaml: Record<string, unknown>;
}
