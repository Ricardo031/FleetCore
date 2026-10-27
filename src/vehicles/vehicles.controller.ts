import {
  Body,
  Controller,
  Delete,
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
import { VehiclesService } from './vehicles.service.js';
import { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import { UpdateVehicleDto } from './dto/update-vehicle.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enums.js';
import { ApiProtected } from '../common/decorators/api-protected.decorator.js';

@ApiTags('Vehicles')
@ApiProtected()
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @ApiOperation({ summary: 'Register a vehicle (ADMIN)' })
  @ApiBadRequestResponse({ description: 'Invalid data' })
  @ApiConflictResponse({ description: 'Plate already registered' })
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateVehicleDto) {
    return this.vehicles.create(dto);
  }

  @ApiOperation({ summary: 'List all vehicles (ADMIN, TECHNICIAN)' })
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @Get()
  findAll() {
    return this.vehicles.findAll();
  }

  // Declared before ':id' so "plate" is not parsed as an id
  @ApiOperation({ summary: 'Find a vehicle by plate (ADMIN, TECHNICIAN)' })
  @ApiNotFoundResponse({ description: 'Vehicle not found' })
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @Get('plate/:plate')
  findByPlate(@Param('plate') plate: string) {
    return this.vehicles.findByPlate(plate);
  }

  @ApiOperation({ summary: 'Find a vehicle by id (ADMIN, TECHNICIAN)' })
  @ApiBadRequestResponse({ description: 'Id is not a number' })
  @ApiNotFoundResponse({ description: 'Vehicle not found' })
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.vehicles.findOne(id);
  }

  @ApiOperation({
    summary: 'Maintenance history of a vehicle: COMPLETED ones (ADMIN)',
  })
  @ApiNotFoundResponse({ description: 'Vehicle not found' })
  @Roles(Role.ADMIN)
  @Get(':id/history')
  findHistory(@Param('id', ParseIntPipe) id: number) {
    return this.vehicles.findHistory(id);
  }

  @ApiOperation({
    summary: 'Update a vehicle (ADMIN)',
    description:
      'IN_MAINTENANCE cannot be set by hand: only the maintenance flow sets it.',
  })
  @ApiBadRequestResponse({ description: 'Invalid data or lower mileage' })
  @ApiNotFoundResponse({ description: 'Vehicle not found' })
  @ApiConflictResponse({
    description:
      'Plate taken, vehicle in maintenance, or active maintenance on deactivation',
  })
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVehicleDto) {
    return this.vehicles.update(id, dto);
  }

  @ApiOperation({
    summary: 'Deactivate a vehicle (ADMIN)',
    description:
      'Logical delete: status becomes INACTIVE and the history is kept.',
  })
  @ApiNotFoundResponse({ description: 'Vehicle not found' })
  @ApiConflictResponse({ description: 'Vehicle has an active maintenance' })
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.vehicles.remove(id);
  }
}
