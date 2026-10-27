import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from '../vehicles/entities/vehicle.entity.js';
import { Maintenance } from '../maintenances/entities/maintenaces.entity.js';
import { VehicleStatus } from '../common/enums/vehicle-status.enums.js';
import { MaintenanceStatus } from '../common/enums/maintenance-status.enum.js';

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(Maintenance)
    private readonly maintenances: Repository<Maintenance>,
  ) {}

  // Completed maintenances of a vehicle, shaped for external partners
  // (only public fields: never the raw entities or linked users)
  async getVehicleHistory(plate: string) {
    const normalized = plate.trim().toUpperCase();
    const vehicle = await this.vehicles.findOne({
      where: { plate: normalized },
    });
    if (!vehicle)
      throw new NotFoundException(`Vehicle with plate ${normalized} not found`);

    const history = await this.maintenances.find({
      where: {
        vehicle: { id: vehicle.id },
        status: MaintenanceStatus.COMPLETED,
      },
      relations: { mechanic: true, workshop: true },
      order: { finishedAt: 'DESC' },
    });

    return {
      vehicle: {
        id: vehicle.id,
        plate: vehicle.plate,
        brand: vehicle.brand,
        model: vehicle.model,
        available: vehicle.status === VehicleStatus.AVAILABLE,
      },
      maintenances: history.map((m) => ({
        id: m.id,
        type: m.type,
        status: m.status,
        description: m.workDone ?? m.description,
        mileage: m.finalMileage ?? m.mileage,
        cost: m.finalCost,
        finishedAt: m.finishedAt,
        mechanic: { id: m.mechanic.id, name: m.mechanic.name },
        workshop: { id: m.workshop.id, name: m.workshop.name },
      })),
    };
  }
}
