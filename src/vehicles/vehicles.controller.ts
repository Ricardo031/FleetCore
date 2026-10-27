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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service.js';
import { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import { UpdateVehicleDto } from './dto/update-vehicle.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enums.js';

@ApiTags('Vehicles')
@ApiBearerAuth()
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateVehicleDto) {
    return this.vehicles.create(dto);
  }

  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @Get()
  findAll() {
    return this.vehicles.findAll();
  }

  // Declared before ':id' so "plate" is not parsed as an id
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @Get('plate/:plate')
  findByPlate(@Param('plate') plate: string) {
    return this.vehicles.findByPlate(plate);
  }

  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.vehicles.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehicles.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.vehicles.remove(id);
  }
}
