import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mechanic } from './entities/mechanics.entity.js';
import { Maintenance } from '../maintenances/entities/maintenaces.entity.js';
import { UsersModule } from '../users/users.module.js';
import { MechanicsController } from './mechanics.controller.js';
import { MechanicsService } from './mechanics.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Mechanic, Maintenance]), UsersModule],
  controllers: [MechanicsController],
  providers: [MechanicsService],
  exports: [MechanicsService],
})
export class MechanicsModule {}
