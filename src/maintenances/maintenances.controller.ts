import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MaintenancesService } from './maintenances.service.js';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enums.js';
import { UpdateMaintenanceStatusDto } from './dto/update-maintenance-status.dto.js';
import type { JwtPayload } from '../common/interface/jwt-payload.interface.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ApiProtected } from '../common/decorators/api-protected.decorator.js';

@ApiTags('Maintenances')
@ApiProtected()
@Controller('maintenances')
export class MaintenancesController {
  constructor(private readonly maintenances: MaintenancesService) {}

  @ApiOperation({
    summary: 'Schedule a maintenance (ADMIN)',
    description:
      'Starts as SCHEDULED. `durationMinutes` defaults to 60 and is used to detect schedule overlaps of the mechanic in any workshop.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid data or mileage lower than the vehicle mileage',
  })
  @ApiNotFoundResponse({
    description: 'Vehicle, mechanic or workshop not found',
  })
  @ApiConflictResponse({
    description:
      'Inactive vehicle/mechanic/workshop, vehicle already has an active maintenance, or mechanic schedule overlap',
  })
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateMaintenanceDto) {
    return this.maintenances.create(dto);
  }

  @ApiOperation({ summary: 'List all maintenances (ADMIN)' })
  @Roles(Role.ADMIN)
  @Get()
  findAll() {
    return this.maintenances.findAll();
  }

  // Fixed routes go before ':id' so "active" or "my" are not parsed as an id
  @ApiOperation({
    summary: 'List active maintenances: SCHEDULED or IN_PROGRESS (ADMIN)',
  })
  @Roles(Role.ADMIN)
  @Get('active')
  findActive() {
    return this.maintenances.findActive();
  }

  @ApiOperation({
    summary: 'My assigned maintenances, with their workshop (TECHNICIAN)',
  })
  @ApiNotFoundResponse({ description: 'User not linked to any mechanic' })
  @Roles(Role.TECHNICIAN)
  @Get('my')
  findMine(@CurrentUser() user: JwtPayload) {
    return this.maintenances.findMine(user);
  }

  @ApiOperation({ summary: 'Maintenances of a vehicle (ADMIN)' })
  @ApiNotFoundResponse({ description: 'Vehicle not found' })
  @Roles(Role.ADMIN)
  @Get('vehicle/:vehicleId')
  findByVehicle(@Param('vehicleId', ParseIntPipe) vehicleId: number) {
    return this.maintenances.findByVehicle(vehicleId);
  }

  @ApiOperation({ summary: 'Maintenances assigned to a mechanic (ADMIN)' })
  @ApiNotFoundResponse({ description: 'Mechanic not found' })
  @Roles(Role.ADMIN)
  @Get('mechanic/:mechanicId')
  findByMechanic(@Param('mechanicId', ParseIntPipe) mechanicId: number) {
    return this.maintenances.findByMechanic(mechanicId);
  }

  @ApiOperation({
    summary: 'Find a maintenance by id (ADMIN, or TECHNICIAN if assigned)',
  })
  @ApiNotFoundResponse({ description: 'Maintenance not found' })
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.maintenances.findOne(id, user);
  }

  @ApiOperation({
    summary: 'Change the status of a maintenance (ADMIN, TECHNICIAN)',
    description:
      'Allowed: SCHEDULED → IN_PROGRESS | CANCELLED, IN_PROGRESS → COMPLETED | CANCELLED. ' +
      'IN_PROGRESS sets the vehicle IN_MAINTENANCE; COMPLETED requires workDone, finalCost, finishedAt and finalMileage and sets the vehicle AVAILABLE. ' +
      'A TECHNICIAN can only update their own maintenances and cannot cancel.',
  })
  @ApiBadRequestResponse({
    description: 'Missing closing data or lower final mileage',
  })
  @ApiNotFoundResponse({ description: 'Maintenance not found' })
  @ApiConflictResponse({ description: 'Invalid status transition' })
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaintenanceStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.maintenances.updateStatus(id, dto, user);
  }
}
