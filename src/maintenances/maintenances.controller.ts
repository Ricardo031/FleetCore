import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MaintenancesService } from './maintenances.service.js';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enums.js';

@ApiTags('Maintenances')
@ApiBearerAuth()
@Controller('maintenances')
export class MaintenancesController {
  constructor(private readonly maintenances: MaintenancesService) {}

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateMaintenanceDto) {
    return this.maintenances.create(dto);
  }
}
