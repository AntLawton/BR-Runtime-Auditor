/** Group sizes to sweep around a declared threshold (±delta). */

export function sweepGroupSizes(threshold: number, delta: number): number[] {
  const sizes = new Set<number>();
  for (let d = -delta; d <= delta; d++) {
    sizes.add(Math.max(0, threshold + d));
  }
  return [...sizes].sort((a, b) => a - b);
}
