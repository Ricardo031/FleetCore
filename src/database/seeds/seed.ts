// database/seeds/seed.ts
import { NestFactory } from '@nestjs/core';
import bcrypt from 'bcrypt';
import { AppModule } from '../../app.module.js';
import {
  DataSource,
  DeepPartial,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { Mechanic } from '../../mechanics/entities/mechanics.entity.js';
import { Workshop } from '../../workshops/entities/workshops.entity.js';
import { Vehicle } from '../../vehicles/entities/vehicle.entity.js';
import { Maintenance } from '../../maintenances/entities/maintenaces.entity.js';
import { Role } from '../../common/enums/role.enums.js';
import { EntityStatus } from '../../common/enums/entity-status.enum.js';
import { VehicleStatus } from '../../common/enums/vehicle-status.enums.js';
import { MaintenanceType } from '../../common/enums/maintenance-type.enum.js';
import { MaintenanceStatus } from '../../common/enums/maintenance-status.enum.js';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);

  const findOrCreate = async <T extends ObjectLiteral>(
    repo: Repository<T>,
    where: FindOptionsWhere<T>,
    data: DeepPartial<T>,
  ) => (await repo.findOne({ where })) ?? repo.save(repo.create(data));

  const users = ds.getRepository(User);
  const mechanics = ds.getRepository(Mechanic);
  const workshops = ds.getRepository(Workshop);
  const vehicles = ds.getRepository(Vehicle);
  const maintenances = ds.getRepository(Maintenance);

  const hash = (p: string) => bcrypt.hash(p, 10);

  // 1 admin, 2 technicians
  await findOrCreate(
    users,
    { email: 'admin@fleetcore.com' },
    {
      name: 'Admin',
      email: 'admin@fleetcore.com',
      password: await hash('Admin123*'),
      role: Role.ADMIN,
    },
  );
  const tech1 = await findOrCreate(
    users,
    { email: 'tech1@fleetcore.com' },
    {
      name: 'Carlos Pérez',
      email: 'tech1@fleetcore.com',
      password: await hash('Tech123*'),
      role: Role.TECHNICIAN,
    },
  );
  const tech2 = await findOrCreate(
    users,
    { email: 'tech2@fleetcore.com' },
    {
      name: 'Laura Gómez',
      email: 'tech2@fleetcore.com',
      password: await hash('Tech123*'),
      role: Role.TECHNICIAN,
    },
  );

  // 3 mechanics: 2 active linked to technicians, 1 inactive
  const m1 = await findOrCreate(
    mechanics,
    { email: 'carlos@fleetcore.com' },
    {
      name: 'Carlos Pérez',
      email: 'carlos@fleetcore.com',
      specialty: 'Motor',
      status: EntityStatus.ACTIVE,
      user: tech1,
    },
  );
  const m2 = await findOrCreate(
    mechanics,
    { email: 'laura@fleetcore.com' },
    {
      name: 'Laura Gómez',
      email: 'laura@fleetcore.com',
      specialty: 'Frenos',
      status: EntityStatus.ACTIVE,
      user: tech2,
    },
  );
  await findOrCreate(
    mechanics,
    { email: 'pedro@fleetcore.com' },
    {
      name: 'Pedro Ruiz',
      email: 'pedro@fleetcore.com',
      specialty: 'Electricidad',
      status: EntityStatus.INACTIVE,
    },
  );

  // 2 talleres: 1 activo, 1 inactivo
  const centro = await findOrCreate(
    workshops,
    { name: 'Taller Centro' },
    {
      name: 'Taller Centro',
      address: 'Calle 45 # 20-10',
      status: EntityStatus.ACTIVE,
    },
  );
  await findOrCreate(
    workshops,
    { name: 'Taller Sur' },
    {
      name: 'Taller Sur',
      address: 'Carrera 8 # 3-50',
      status: EntityStatus.INACTIVE,
    },
  );

  // 4 vehicles: 2 AVAILABLE, 1 IN_MAINTENANCE, 1 INACTIVE
  const v1 = await findOrCreate(
    vehicles,
    { plate: 'ABC123' },
    {
      plate: 'ABC123',
      brand: 'Chevrolet',
      model: 'NPR',
      year: 2020,
      mileage: 45050,
      status: VehicleStatus.AVAILABLE,
    },
  );
  await findOrCreate(
    vehicles,
    { plate: 'DEF456' },
    {
      plate: 'DEF456',
      brand: 'Renault',
      model: 'Logan',
      year: 2022,
      mileage: 12000,
      status: VehicleStatus.AVAILABLE,
    },
  );
  const v3 = await findOrCreate(
    vehicles,
    { plate: 'GHI789' },
    {
      plate: 'GHI789',
      brand: 'Hino',
      model: '300',
      year: 2019,
      mileage: 78000,
      status: VehicleStatus.IN_MAINTENANCE,
    },
  );
  await findOrCreate(
    vehicles,
    { plate: 'JKL012' },
    {
      plate: 'JKL012',
      brand: 'Isuzu',
      model: 'NKR',
      year: 2015,
      mileage: 150000,
      status: VehicleStatus.INACTIVE,
    },
  );

  // Maintenance COMPLETED
  await findOrCreate(
    maintenances,
    { vehicle: { id: v1.id }, description: 'Cambio de aceite y filtros' },
    {
      type: MaintenanceType.PREVENTIVE,
      description: 'Cambio de aceite y filtros',
      mileage: 45000,
      scheduledAt: new Date('2026-09-15T14:00:00Z'),
      scheduledEndAt: new Date('2026-09-15T16:00:00Z'),
      status: MaintenanceStatus.COMPLETED,
      workDone: 'Cambio de aceite y filtros',
      finalCost: 350000,
      finishedAt: new Date('2026-09-15T16:30:00Z'),
      finalMileage: 45050,
      vehicle: v1,
      mechanic: m1,
      workshop: centro,
    },
  );

  // Maintenance IN_PROGRESS (GHI789 está IN_MAINTENANCE)
  await findOrCreate(
    maintenances,
    { vehicle: { id: v3.id }, status: MaintenanceStatus.IN_PROGRESS },
    {
      type: MaintenanceType.CORRECTIVE,
      description: 'Reemplazo de pastillas de freno',
      mileage: 78000,
      scheduledAt: new Date('2026-10-26T13:00:00Z'),
      scheduledEndAt: new Date('2026-10-26T15:00:00Z'),
      status: MaintenanceStatus.IN_PROGRESS,
      vehicle: v3,
      mechanic: m2,
      workshop: centro,
    },
  );

  await app.close();
  console.log('Seed completado');
}
bootstrap();
