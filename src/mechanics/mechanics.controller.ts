import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MechanicsService } from './mechanics.service.js';
import { CreateMechanicDto } from './dto/create-mechanic.dto.js';
import { UpdateMechanicDto } from './dto/update-mechanic.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enums.js';

@ApiTags('Mechanics')
@ApiBearerAuth()
@Roles(Role.ADMIN) // every mechanic endpoint is ADMIN only
@Controller('mechanics')
export class MechanicsController {
  constructor(private readonly mechanics: MechanicsService) {}

  @Post()
  create(@Body() dto: CreateMechanicDto) {
    return this.mechanics.create(dto);
  }

  @Get()
  findAll() {
    return this.mechanics.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.mechanics.findOne(id);
  }

  @Get(':id/maintenances')
  findMaintenances(@Param('id', ParseIntPipe) id: number) {
    return this.mechanics.findMaintenances(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMechanicDto,
  ) {
    return this.mechanics.update(id, dto);
  }

  @Patch(':id/activate')
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.mechanics.activate(id);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.mechanics.deactivate(id);
  }
}
