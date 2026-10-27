import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In, LessThan, MoreThan } from 'typeorm';
import { Maintenance } from './entities/maintenaces.entity.js';
import { Vehicle } from '../vehicles/entities/vehicle.entity.js';
import { Mechanic } from '../mechanics/entities/mechanics.entity.js';
import { Workshop } from '../workshops/entities/workshops.entity.js';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto.js';
import { computeEndDate } from './maintenance-rules.js';
import { VehicleStatus } from '../common/enums/vehicle-status.enums.js';
import { EntityStatus } from '../common/enums/entity-status.enum.js';
import {
  ACTIVE_MAINTENANCE_STATUSES,
  MaintenanceStatus,
} from '../common/enums/maintenance-status.enum.js';

@Injectable()
export class MaintenancesService {
  constructor(private readonly dataSource: DataSource) {}

  async create(dto: CreateMaintenanceDto) {
    // TRANSACTION: every check and the insert run together; if any rule fails nothing is saved
    return this.dataSource.transaction(async (manager) => {
      const vehicle = await manager.findOne(Vehicle, {
        where: { id: dto.vehicleId },
      });
      if (!vehicle)
        throw new NotFoundException(`Vehicle ${dto.vehicleId} not found`);
      if (vehicle.status === VehicleStatus.INACTIVE)
        throw new ConflictException(`Vehicle ${vehicle.plate} is inactive`);

      const mechanic = await manager.findOne(Mechanic, {
        where: { id: dto.mechanicId },
      });
      if (!mechanic)
        throw new NotFoundException(`Mechanic ${dto.mechanicId} not found`);
      if (mechanic.status !== EntityStatus.ACTIVE)
        throw new ConflictException(`Mechanic ${mechanic.name} is inactive`);

      const workshop = await manager.findOne(Workshop, {
        where: { id: dto.workshopId },
      });
      if (!workshop)
        throw new NotFoundException(`Workshop ${dto.workshopId} not found`);
      if (workshop.status !== EntityStatus.ACTIVE)
        throw new ConflictException(`Workshop ${workshop.name} is inactive`);

      if (dto.mileage < vehicle.mileage)
        throw new BadRequestException(
          `Mileage (${dto.mileage}) cannot be lower than the vehicle's current mileage (${vehicle.mileage})`,
        );

      // A vehicle can only have one active maintenance
      const vehicleBusy = await manager.exists(Maintenance, {
        where: {
          vehicle: { id: vehicle.id },
          status: In(ACTIVE_MAINTENANCE_STATUSES),
        },
      });
      if (vehicleBusy)
        throw new ConflictException(
          `Vehicle ${vehicle.plate} already has an active maintenance`,
        );

      // A mechanic cannot have overlapping active maintenances, in any workshop.
      // SQL version of overlaps(): existing.start < newEnd AND existing.end > newStart
      const start = dto.scheduledAt;
      const end = computeEndDate(start, dto.durationMinutes);
      const scheduleClash = await manager.exists(Maintenance, {
        where: {
          mechanic: { id: mechanic.id },
          status: In(ACTIVE_MAINTENANCE_STATUSES),
          scheduledAt: LessThan(end),
          scheduledEndAt: MoreThan(start),
        },
      });
      if (scheduleClash)
        throw new ConflictException(
          `Mechanic ${mechanic.name} already has a maintenance in that time slot`,
        );

      return manager.save(
        manager.create(Maintenance, {
          type: dto.type,
          description: dto.description,
          mileage: dto.mileage,
          scheduledAt: start,
          scheduledEndAt: end,
          status: MaintenanceStatus.SCHEDULED, // fixed initial status
          vehicle,
          mechanic,
          workshop,
        }),
      );
    });
  }
}
