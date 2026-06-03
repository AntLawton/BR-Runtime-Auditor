/** Pure aggregation-floor check — sub-threshold groups must not surface. */

export function shouldSurfaceAggregate(groupSize: number, minThreshold: number): boolean {
  return groupSize >= minThreshold;
}

export function sweepThreshold(
  threshold: number,
  delta: number,
): { groupSize: number; surfaces: boolean }[] {
  const sizes = new Set<number>();
  for (let d = -delta; d <= delta; d++) {
    sizes.add(Math.max(0, threshold + d));
  }
  return [...sizes].sort((a, b) => a - b).map((groupSize) => ({
    groupSize,
    surfaces: shouldSurfaceAggregate(groupSize, threshold),
  }));
}
