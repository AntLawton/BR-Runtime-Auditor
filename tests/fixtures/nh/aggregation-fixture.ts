const THRESHOLD_BY_NAME: Record<string, number> = {
  MIN_RECORDINGS_FOR_AGGREGATION: 10,
  MIN_RECORDINGS_FOR_COMMISSION: 20,
  DEFAULT_K_ANONYMITY: 5,
};

/** Product aggregation gate — sub-threshold groups must not surface in output. */
export function shouldSurfaceAggregate(groupSize: number, thresholdName: string): boolean {
  const min = THRESHOLD_BY_NAME[thresholdName];
  if (min === undefined) return false;
  return groupSize >= min;
}
