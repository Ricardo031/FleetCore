import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThan, MoreThan, Repository } from 'typeorm';
import { Maintenance } from './entities/maintenaces.entity.js';
import { Vehicle } from '../vehicles/entities/vehicle.entity.js';
import { Mechanic } from '../mechanics/entities/mechanics.entity.js';
import { Workshop } from '../workshops/entities/workshops.entity.js';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto.js';
import {
  assertClosingData,
  assertTransition,
  computeEndDate,
} from './maintenance-rules.js';
import { VehicleStatus } from '../common/enums/vehicle-status.enums.js';
import { EntityStatus } from '../common/enums/entity-status.enum.js';
import {
  ACTIVE_MAINTENANCE_STATUSES,
  MaintenanceStatus,
} from '../common/enums/maintenance-status.enum.js';
import { UpdateMaintenanceStatusDto } from './dto/update-maintenance-status.dto.js';
import { JwtPayload } from '../common/interface/jwt-payload.interface.js';
import { Role } from '../common/enums/role.enums.js';

// Relations shown in every listing: what, who and where
const LIST_RELATIONS = { vehicle: true, mechanic: true, workshop: true };

@Injectable()
export class MaintenancesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Maintenance)
    private readonly repo: Repository<Maintenance>,
  ) {}

  findAll() {
    return this.repo.find({
      relations: LIST_RELATIONS,
      order: { scheduledAt: 'DESC' },
    });
  }

  findActive() {
    return this.repo.find({
      where: { status: In(ACTIVE_MAINTENANCE_STATUSES) },
      relations: LIST_RELATIONS,
      order: { scheduledAt: 'ASC' },
    });
  }

  async findByVehicle(vehicleId: number) {
    const exists = await this.dataSource
      .getRepository(Vehicle)
      .exists({ where: { id: vehicleId } });
    if (!exists) throw new NotFoundException(`Vehicle ${vehicleId} not found`);

    return this.repo.find({
      where: { vehicle: { id: vehicleId } },
      relations: LIST_RELATIONS,
      order: { scheduledAt: 'DESC' },
    });
  }

  async findByMechanic(mechanicId: number) {
    const exists = await this.dataSource
      .getRepository(Mechanic)
      .exists({ where: { id: mechanicId } });
    if (!exists)
      throw new NotFoundException(`Mechanic ${mechanicId} not found`);

    return this.repo.find({
      where: { mechanic: { id: mechanicId } },
      relations: LIST_RELATIONS,
      order: { scheduledAt: 'DESC' },
    });
  }

  // Maintenances of the mechanic linked to the logged-in TECHNICIAN, with the workshop where to go
  async findMine(user: JwtPayload) {
    const mechanic = await this.dataSource
      .getRepository(Mechanic)
      .findOne({ where: { user: { id: user.sub } } });
    if (!mechanic)
      throw new NotFoundException('Your user is not linked to any mechanic');

    return this.repo.find({
      where: { mechanic: { id: mechanic.id } },
      relations: { vehicle: true, workshop: true },
      order: { scheduledAt: 'ASC' },
    });
  }

  async findOne(id: number, user: JwtPayload) {
    const maintenance = await this.repo.findOne({
      where: { id },
      relations: { vehicle: true, mechanic: { user: true }, workshop: true },
    });
    if (!maintenance)
      throw new NotFoundException(`Maintenance ${id} not found`);

    if (
      user.role === Role.TECHNICIAN &&
      maintenance.mechanic.user?.id !== user.sub
    )
      throw new ForbiddenException('Maintenance not assigned to you');

    return maintenance;
  }

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

  async updateStatus(
    id: number,
    dto: UpdateMaintenanceStatusDto,
    user: JwtPayload,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const maintenance = await manager.findOne(Maintenance, {
        where: { id },
        relations: { vehicle: true, mechanic: { user: true }, workshop: true },
      });
      if (!maintenance)
        throw new NotFoundException(`Maintenance ${id} not found`);

      // Un TECHNICIAN solo toca lo suyo y no puede cancelar
      if (user.role === Role.TECHNICIAN) {
        if (maintenance.mechanic.user?.id !== user.sub)
          throw new ForbiddenException('Maintenance not assigned to you');
        if (dto.status === MaintenanceStatus.CANCELLED)
          throw new ForbiddenException(
            'Only admin can cancel maintenance status',
          );
      }

      assertTransition(maintenance.status, dto.status); // 409 si es inválida
      const vehicle = maintenance.vehicle;

      switch (dto.status) {
        case MaintenanceStatus.IN_PROGRESS:
          if (vehicle.status === VehicleStatus.INACTIVE)
            throw new ConflictException(`Vehicle ${vehicle.plate} is inactive`);
          vehicle.status = VehicleStatus.IN_MAINTENANCE; // regla automática
          break;

        case MaintenanceStatus.COMPLETED:
          assertClosingData(dto); // 400 si faltan datos
          if (dto.finalMileage! < vehicle.mileage)
            throw new BadRequestException(
              `Final mileage (${dto.finalMileage}) cannot be lower than the vehicle's current mileage (${vehicle.mileage})`,
            );
          maintenance.workDone = dto.workDone!;
          maintenance.finalCost = dto.finalCost!;
          maintenance.finishedAt = dto.finishedAt!;
          maintenance.finalMileage = dto.finalMileage!;
          vehicle.status = VehicleStatus.AVAILABLE; // regla automática
          vehicle.mileage = dto.finalMileage!;
          break;

        case MaintenanceStatus.CANCELLED:
          if (maintenance.status === MaintenanceStatus.IN_PROGRESS)
            vehicle.status = VehicleStatus.AVAILABLE; // no dejarlo "en taller" para siempre
          break;
      }

      maintenance.status = dto.status;
      await manager.save([vehicle, maintenance]);
      return maintenance;
    });
  }
}
