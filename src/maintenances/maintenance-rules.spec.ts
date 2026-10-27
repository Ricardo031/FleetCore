import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  assertClosingData,
  assertTransition,
  computeEndDate,
  overlaps,
} from './maintenance-rules.js';
import { MaintenanceStatus } from '../common/enums/maintenance-status.enum.js';

const { SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED } = MaintenanceStatus;

describe('assertTransition', () => {
  it.each([
    [SCHEDULED, IN_PROGRESS],
    [SCHEDULED, CANCELLED],
    [IN_PROGRESS, COMPLETED],
    [IN_PROGRESS, CANCELLED],
  ])('allows %s → %s', (from, to) => {
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it.each([
    [COMPLETED, SCHEDULED],
    [COMPLETED, IN_PROGRESS],
    [COMPLETED, CANCELLED],
    [CANCELLED, IN_PROGRESS],
    [CANCELLED, COMPLETED],
    [SCHEDULED, COMPLETED],
  ])('rejects %s → %s with 409', (from, to) => {
    expect(() => assertTransition(from, to)).toThrow(ConflictException);
  });

  it('rejects moving to the same status', () => {
    expect(() => assertTransition(SCHEDULED, SCHEDULED)).toThrow(
      'Maintenance is already SCHEDULED',
    );
  });
});

describe('assertClosingData', () => {
  it('passes when every closing field is present', () => {
    expect(() =>
      assertClosingData({
        workDone: 'Oil change',
        finalCost: 0, // 0 is a valid cost
        finishedAt: new Date(),
        finalMileage: 100,
      }),
    ).not.toThrow();
  });

  it('lists every missing field', () => {
    expect(() => assertClosingData({ workDone: '   ' })).toThrow(
      new BadRequestException(
        'Cannot complete the maintenance. Missing: workDone, finalCost, finishedAt, finalMileage',
      ),
    );
  });
});

describe('overlaps (half-open intervals)', () => {
  const at = (hhmm: string) => new Date(`2026-11-03T${hhmm}:00Z`);

  it('7:30–9:00 vs 8:00–9:00 overlap', () => {
    expect(overlaps(at('07:30'), at('09:00'), at('08:00'), at('09:00'))).toBe(
      true,
    );
  });

  it('7:30–9:00 vs 7:30–8:00 overlap (same start)', () => {
    expect(overlaps(at('07:30'), at('09:00'), at('07:30'), at('08:00'))).toBe(
      true,
    );
  });

  it('7:30–9:00 vs 9:00–10:00 do not overlap', () => {
    expect(overlaps(at('07:30'), at('09:00'), at('09:00'), at('10:00'))).toBe(
      false,
    );
  });
});

describe('computeEndDate', () => {
  it('defaults to 60 minutes', () => {
    const start = new Date('2026-11-03T07:30:00Z');
    expect(computeEndDate(start).toISOString()).toBe(
      '2026-11-03T08:30:00.000Z',
    );
  });

  it('uses the given duration', () => {
    const start = new Date('2026-11-03T07:30:00Z');
    expect(computeEndDate(start, 90).toISOString()).toBe(
      '2026-11-03T09:00:00.000Z',
    );
  });
});
