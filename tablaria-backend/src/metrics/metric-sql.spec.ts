import { METRICS_MAX_GROUPS, type MetricGroup } from '@tablaria/shared';
import { summarizeGroups } from './metric-sql';

const group = (
  value: string,
  count: number,
  filled: number,
  measure: number | null,
): MetricGroup => ({ value, count, filled, measure });

describe('summarizeGroups', () => {
  const first = Array.from({ length: METRICS_MAX_GROUPS }, (_, index) =>
    group(`g${index}`, 10, 10, 100),
  );

  it('keeps the largest groups and puts the rest together', () => {
    const rest = [group('a', 2, 2, 30), group('b', 3, 1, 10)];
    const summary = summarizeGroups([...first, ...rest], 90, 'sum');
    expect(summary.groups).toEqual(first);
    expect(summary.others).toEqual({
      groupCount: 2,
      count: 5,
      filled: 3,
      measure: 40,
    });
  });

  it('puts averages together weighted by their values, and extremes as extremes', () => {
    // An average of 30 over 2 values and of 10 over 1: 70 / 3.
    const rest = [group('a', 2, 2, 30), group('b', 3, 1, 10)];
    expect(
      summarizeGroups([...first, ...rest], 90, 'avg').others?.measure,
    ).toBeCloseTo(70 / 3);
    expect(
      summarizeGroups([...first, ...rest], 90, 'min').others?.measure,
    ).toBe(10);
    expect(
      summarizeGroups([...first, ...rest], 90, 'max').others?.measure,
    ).toBe(30);
    // A group without values changes nothing.
    expect(
      summarizeGroups([...first, group('c', 1, 0, null), ...rest], 90, 'avg')
        .others?.measure,
    ).toBeCloseTo(70 / 3);
  });

  it('has no others when every group fits', () => {
    expect(summarizeGroups([], 0, 'sum')).toEqual({
      total: 0,
      groups: [],
      others: null,
      labels: {},
    });
  });
});
