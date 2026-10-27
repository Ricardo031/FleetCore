import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MaintenancesService } from './maintenances.service.js';
import { Vehicle } from '../vehicles/entities/vehicle.entity.js';
import { Mechanic } from '../mechanics/entities/mechanics.entity.js';
import { Workshop } from '../workshops/entities/workshops.entity.js';
import { MaintenanceStatus } from '../common/enums/maintenance-status.enum.js';
import { MaintenanceType } from '../common/enums/maintenance-type.enum.js';
import { VehicleStatus } from '../common/enums/vehicle-status.enums.js';
import { EntityStatus } from '../common/enums/entity-status.enum.js';
import { Role } from '../common/enums/role.enums.js';
import type { JwtPayload } from '../common/interface/jwt-payload.interface.js';

const admin: JwtPayload = { sub: 1, email: 'admin@t.com', role: Role.ADMIN };
const tech: JwtPayload = { sub: 7, email: 'tech@t.com', role: Role.TECHNICIAN };

// Fake EntityManager: the transaction callback receives it instead of a real DB connection
const makeService = (found: Map<unknown, unknown>, exists: boolean[] = []) => {
  const manager = {
    findOne: vi.fn(async (entity: unknown) => found.get(entity) ?? null),
    exists: vi.fn(async () => exists.shift() ?? false),
    create: vi.fn((_entity: unknown, data: object) => data),
    save: vi.fn(async (data: unknown) => data),
  };
  const dataSource = {
    transaction: (cb: (m: typeof manager) => unknown) => cb(manager),
  };
  const service = new MaintenancesService(dataSource as any, {} as any);
  return { service, manager };
};

describe('MaintenancesService.updateStatus', () => {
  const makeMaintenance = (status: MaintenanceStatus) => ({
    id: 1,
    status,
    vehicle: {
      plate: 'ABC123',
      status: VehicleStatus.AVAILABLE,
      mileage: 1000,
    },
    mechanic: { user: { id: tech.sub } },
  });

  const run = (maintenance: object | null, dto: object, user = admin) => {
    // the service looks the maintenance up with manager.findOne(Maintenance, ...)
    const { service, manager } = makeService(new Map());
    manager.findOne.mockResolvedValue(maintenance);
    return { result: service.updateStatus(1, dto as any, user), manager };
  };

  it('IN_PROGRESS sets the vehicle IN_MAINTENANCE', async () => {
    const m = makeMaintenance(MaintenanceStatus.SCHEDULED);
    const { result, manager } = run(m, {
      status: MaintenanceStatus.IN_PROGRESS,
    });

    await expect(result).resolves.toMatchObject({ status: 'IN_PROGRESS' });
    expect(m.vehicle.status).toBe(VehicleStatus.IN_MAINTENANCE);
    expect(manager.save).toHaveBeenCalledWith([m.vehicle, m]);
  });

  it('COMPLETED without closing data fails with 400 and saves nothing', async () => {
    const m = makeMaintenance(MaintenanceStatus.IN_PROGRESS);
    const { result, manager } = run(m, { status: MaintenanceStatus.COMPLETED });

    await expect(result).rejects.toThrow(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('COMPLETED stores closing data, frees the vehicle and updates its mileage', async () => {
    const m = makeMaintenance(MaintenanceStatus.IN_PROGRESS);
    m.vehicle.status = VehicleStatus.IN_MAINTENANCE;
    const { result } = run(m, {
      status: MaintenanceStatus.COMPLETED,
      workDone: 'Oil change',
      finalCost: 350000,
      finishedAt: new Date('2026-11-03T09:00:00Z'),
      finalMileage: 1050,
    });

    await expect(result).resolves.toMatchObject({
      status: 'COMPLETED',
      finalCost: 350000,
      finalMileage: 1050,
    });
    expect(m.vehicle).toMatchObject({
      status: VehicleStatus.AVAILABLE,
      mileage: 1050,
    });
  });

  it('COMPLETED with a final mileage lower than the vehicle fails with 400', async () => {
    const m = makeMaintenance(MaintenanceStatus.IN_PROGRESS);
    const { result } = run(m, {
      status: MaintenanceStatus.COMPLETED,
      workDone: 'Oil change',
      finalCost: 1,
      finishedAt: new Date(),
      finalMileage: 10,
    });
    await expect(result).rejects.toThrow(BadRequestException);
  });

  it('cancelling an IN_PROGRESS maintenance frees the vehicle', async () => {
    const m = makeMaintenance(MaintenanceStatus.IN_PROGRESS);
    m.vehicle.status = VehicleStatus.IN_MAINTENANCE;
    const { result } = run(m, { status: MaintenanceStatus.CANCELLED });

    await result;
    expect(m.vehicle.status).toBe(VehicleStatus.AVAILABLE);
  });

  it('a COMPLETED maintenance cannot go back (409)', async () => {
    const m = makeMaintenance(MaintenanceStatus.COMPLETED);
    const { result } = run(m, { status: MaintenanceStatus.IN_PROGRESS });
    await expect(result).rejects.toThrow(ConflictException);
  });

  it('a TECHNICIAN cannot touch a maintenance assigned to someone else (403)', async () => {
    const m = makeMaintenance(MaintenanceStatus.SCHEDULED);
    m.mechanic.user.id = 999;
    const { result } = run(m, { status: MaintenanceStatus.IN_PROGRESS }, tech);
    await expect(result).rejects.toThrow(ForbiddenException);
  });

  it('a TECHNICIAN cannot cancel (403)', async () => {
    const m = makeMaintenance(MaintenanceStatus.SCHEDULED);
    const { result } = run(m, { status: MaintenanceStatus.CANCELLED }, tech);
    await expect(result).rejects.toThrow(ForbiddenException);
  });

  it('a TECHNICIAN can start their own maintenance', async () => {
    const m = makeMaintenance(MaintenanceStatus.SCHEDULED);
    const { result } = run(m, { status: MaintenanceStatus.IN_PROGRESS }, tech);
    await expect(result).resolves.toMatchObject({ status: 'IN_PROGRESS' });
  });

  it('unknown maintenance fails with 404', async () => {
    const { result } = run(null, { status: MaintenanceStatus.IN_PROGRESS });
    await expect(result).rejects.toThrow(NotFoundException);
  });
});

describe('MaintenancesService.create', () => {
  const dto = {
    type: MaintenanceType.PREVENTIVE,
    description: 'Oil change',
    mileage: 1000,
    scheduledAt: new Date('2026-11-03T07:30:00Z'),
    durationMinutes: 90,
    vehicleId: 1,
    mechanicId: 1,
    workshopId: 1,
  };

  const entities = (overrides: Partial<Record<string, object>> = {}) =>
    new Map<unknown, unknown>([
      [
        Vehicle,
        {
          id: 1,
          plate: 'ABC123',
          status: VehicleStatus.AVAILABLE,
          mileage: 1000,
          ...overrides.vehicle,
        },
      ],
      [
        Mechanic,
        {
          id: 1,
          name: 'Carlos',
          status: EntityStatus.ACTIVE,
          ...overrides.mechanic,
        },
      ],
      [
        Workshop,
        {
          id: 1,
          name: 'Centro',
          status: EntityStatus.ACTIVE,
          ...overrides.workshop,
        },
      ],
    ]);

  it('creates a SCHEDULED maintenance with the computed end time', async () => {
    const { service } = makeService(entities());
    await expect(service.create(dto)).resolves.toMatchObject({
      status: MaintenanceStatus.SCHEDULED,
      scheduledEndAt: new Date('2026-11-03T09:00:00Z'),
    });
  });

  it('rejects an unknown vehicle (404)', async () => {
    const found = entities();
    found.delete(Vehicle);
    const { service } = makeService(found);
    await expect(service.create(dto)).rejects.toThrow(NotFoundException);
  });

  it.each([
    ['inactive vehicle', { vehicle: { status: VehicleStatus.INACTIVE } }],
    ['inactive mechanic', { mechanic: { status: EntityStatus.INACTIVE } }],
    ['inactive workshop', { workshop: { status: EntityStatus.INACTIVE } }],
  ])('rejects an %s (409)', async (_label, overrides) => {
    const { service } = makeService(entities(overrides));
    await expect(service.create(dto)).rejects.toThrow(ConflictException);
  });

  it('rejects a mileage lower than the vehicle mileage (400)', async () => {
    const { service } = makeService(entities({ vehicle: { mileage: 5000 } }));
    await expect(service.create(dto)).rejects.toThrow(BadRequestException);
  });

  it('rejects a vehicle that already has an active maintenance (409)', async () => {
    const { service } = makeService(entities(), [true]);
    await expect(service.create(dto)).rejects.toThrow(
      'Vehicle ABC123 already has an active maintenance',
    );
  });

  it('rejects a mechanic schedule overlap (409)', async () => {
    const { service } = makeService(entities(), [false, true]);
    await expect(service.create(dto)).rejects.toThrow(
      'Mechanic Carlos already has a maintenance in that time slot',
    );
  });
});
