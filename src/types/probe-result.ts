export type Verdict = 'GREEN' | 'AMBER' | 'RED' | 'DEFERRED' | 'SKIPPED';

export interface Evidence {
  summary: string;
  citation?: string;
  command?: string;
}

export interface SubProbeResult {
  id: string;
  verdict: Verdict;
  detail: string;
  citation?: string;
}

export interface ProbeResult {
  probeId: string;
  probeName: string;
  verdict: Verdict;
  subProbes: SubProbeResult[];
  evidence: Evidence[];
  note?: string;
}

export interface ContractRoute {
  contract: string;
  probe: string;
  verdict?: Verdict;
  note?: string;
}

export interface RoutingCoverage {
  contract: string;
  probe: string;
  routed: boolean;
  verdict?: Verdict;
  note?: string;
}
