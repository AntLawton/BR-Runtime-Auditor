import { DEFAULT_MINIMUM_AGGREGATION } from './shared-constants-fixture.js';

const THRESHOLD_BY_NAME: Record<string, number> = {
  DEFAULT_MINIMUM_AGGREGATION,
};

/** Product aggregation gate — sub-threshold groups must not surface in output. */
export function shouldSurfaceAggregate(groupSize: number, thresholdName: string): boolean {
  const min = THRESHOLD_BY_NAME[thresholdName] ?? DEFAULT_MINIMUM_AGGREGATION;
  return groupSize >= min;
}
