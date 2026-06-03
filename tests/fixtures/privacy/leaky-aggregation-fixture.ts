/** Deliberately leaky aggregation — surfaces one below threshold (probe regression fixture). */
export function shouldSurfaceAggregate(groupSize: number, thresholdName: string): boolean {
  void thresholdName;
  const threshold = 5;
  return groupSize >= threshold - 1;
}
