import { BadRequestException, ConflictException } from '@nestjs/common';
import { MaintenanceStatus } from '../common/enums/maintenance-status.enum.js';

// Pure business rules (no DB access) so they are easy to unit test

// STATE MACHINE: which statuses each status can move to
export const ALLOWED_TRANSITIONS: Record<
  MaintenanceStatus,
  MaintenanceStatus[]
> = {
  [MaintenanceStatus.SCHEDULED]: [
    MaintenanceStatus.IN_PROGRESS,
    MaintenanceStatus.CANCELLED,
  ],
  [MaintenanceStatus.IN_PROGRESS]: [
    MaintenanceStatus.COMPLETED,
    MaintenanceStatus.CANCELLED,
  ],
  [MaintenanceStatus.COMPLETED]: [], // final status
  [MaintenanceStatus.CANCELLED]: [], // final status
};

export function assertTransition(
  from: MaintenanceStatus,
  to: MaintenanceStatus,
) {
  if (from === to)
    throw new ConflictException(`Maintenance is already ${from}`);
  if (!ALLOWED_TRANSITIONS[from].includes(to))
    throw new ConflictException(
      `Invalid transition: a ${from} maintenance cannot move to ${to}`,
    );
}

// Data required to close (complete) a maintenance
export function assertClosingData(dto: {
  workDone?: string;
  finalCost?: number;
  finishedAt?: string | Date;
  finalMileage?: number;
}) {
  const missing: string[] = [];
  if (!dto.workDone?.trim()) missing.push('workDone');
  if (dto.finalCost == null) missing.push('finalCost');
  if (!dto.finishedAt) missing.push('finishedAt');
  if (dto.finalMileage == null) missing.push('finalMileage');
  if (missing.length)
    throw new BadRequestException(
      `Cannot complete the maintenance. Missing: ${missing.join(', ')}`,
    );
}

// SCHEDULE OVERLAP: half-open intervals [start, end)
// 7:30–9:00 vs 9:00–10:00 → false (allowed); 7:30–9:00 vs 8:00–9:00 → true (blocked)
export const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart < bEnd && bStart < aEnd;

export const DEFAULT_DURATION_MINUTES = 60;

export const computeEndDate = (
  start: Date,
  durationMinutes = DEFAULT_DURATION_MINUTES,
) => new Date(start.getTime() + durationMinutes * 60_000);
