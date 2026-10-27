import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Vehicle } from './entities/vehicle.entity.js';
import { Maintenance } from '../maintenances/entities/maintenaces.entity.js';
import { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import { UpdateVehicleDto } from './dto/update-vehicle.dto.js';
import { VehicleStatus } from '../common/enums/vehicle-status.enums.js';
import { ACTIVE_MAINTENANCE_STATUSES } from '../common/enums/maintenance-status.enum.js';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle) private readonly repo: Repository<Vehicle>,
    @InjectRepository(Maintenance)
    private readonly maintenances: Repository<Maintenance>,
  ) {}

  async create(dto: CreateVehicleDto) {
    await this.ensurePlateIsFree(dto.plate);
    return this.repo.save(this.repo.create(dto));
  }

  findAll() {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  async findOne(id: number) {
    const vehicle = await this.repo.findOne({ where: { id } });
    if (!vehicle) throw new NotFoundException(`Vehicle ${id} not found`);
    return vehicle;
  }

  async findByPlate(plate: string) {
    const normalized = plate.trim().toUpperCase();
    const vehicle = await this.repo.findOne({ where: { plate: normalized } });
    if (!vehicle)
      throw new NotFoundException(`Vehicle with plate ${normalized} not found`);
    return vehicle;
  }

  async update(id: number, dto: UpdateVehicleDto) {
    const vehicle = await this.findOne(id);

    if (dto.plate && dto.plate !== vehicle.plate)
      await this.ensurePlateIsFree(dto.plate);

    if (dto.mileage !== undefined && dto.mileage < vehicle.mileage)
      throw new BadRequestException(
        `Mileage (${dto.mileage}) cannot be lower than the current one (${vehicle.mileage})`,
      );

    if (dto.status && dto.status !== vehicle.status) {
      if (vehicle.status === VehicleStatus.IN_MAINTENANCE)
        throw new ConflictException(
          `Vehicle ${vehicle.plate} is in maintenance; its status is managed by the maintenance flow`,
        );
      if (dto.status === VehicleStatus.INACTIVE)
        await this.ensureNoActiveMaintenance(vehicle);
    }

    Object.assign(vehicle, dto);
    return this.repo.save(vehicle);
  }

  // Logical delete: the row stays so its maintenance history is preserved
  async remove(id: number) {
    const vehicle = await this.findOne(id);
    if (vehicle.status === VehicleStatus.INACTIVE) return vehicle;

    await this.ensureNoActiveMaintenance(vehicle);
    vehicle.status = VehicleStatus.INACTIVE;
    return this.repo.save(vehicle);
  }

  private async ensurePlateIsFree(plate: string) {
    if (await this.repo.exists({ where: { plate } }))
      throw new ConflictException(`Plate ${plate} is already registered`);
  }

  private async ensureNoActiveMaintenance(vehicle: Vehicle) {
    const hasActive = await this.maintenances.exists({
      where: {
        vehicle: { id: vehicle.id },
        status: In(ACTIVE_MAINTENANCE_STATUSES),
      },
    });
    if (hasActive)
      throw new ConflictException(
        `Vehicle ${vehicle.plate} has an active maintenance and cannot be deactivated`,
      );
  }
}
