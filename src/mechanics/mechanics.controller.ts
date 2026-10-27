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
import { MechanicsService } from './mechanics.service.js';
import { CreateMechanicDto } from './dto/create-mechanic.dto.js';
import { UpdateMechanicDto } from './dto/update-mechanic.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enums.js';
import { ApiProtected } from '../common/decorators/api-protected.decorator.js';

@ApiTags('Mechanics')
@ApiProtected()
@Roles(Role.ADMIN) // every mechanic endpoint is ADMIN only
@Controller('mechanics')
export class MechanicsController {
  constructor(private readonly mechanics: MechanicsService) {}

  @ApiOperation({
    summary: 'Register a mechanic (ADMIN)',
    description: '`userId` optionally links the mechanic to a TECHNICIAN user.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid data or user is not a TECHNICIAN',
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'Email taken or user already linked' })
  @Post()
  create(@Body() dto: CreateMechanicDto) {
    return this.mechanics.create(dto);
  }

  @ApiOperation({ summary: 'List all mechanics (ADMIN)' })
  @Get()
  findAll() {
    return this.mechanics.findAll();
  }

  @ApiOperation({ summary: 'Find a mechanic by id (ADMIN)' })
  @ApiNotFoundResponse({ description: 'Mechanic not found' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.mechanics.findOne(id);
  }

  @ApiOperation({ summary: 'Maintenance history of a mechanic (ADMIN)' })
  @ApiNotFoundResponse({ description: 'Mechanic not found' })
  @Get(':id/maintenances')
  findMaintenances(@Param('id', ParseIntPipe) id: number) {
    return this.mechanics.findMaintenances(id);
  }

  @ApiOperation({ summary: 'Update a mechanic (ADMIN)' })
  @ApiBadRequestResponse({
    description: 'Invalid data or user is not a TECHNICIAN',
  })
  @ApiNotFoundResponse({ description: 'Mechanic or user not found' })
  @ApiConflictResponse({ description: 'Email taken or user already linked' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMechanicDto,
  ) {
    return this.mechanics.update(id, dto);
  }

  @ApiOperation({ summary: 'Activate a mechanic (ADMIN)' })
  @ApiNotFoundResponse({ description: 'Mechanic not found' })
  @Patch(':id/activate')
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.mechanics.activate(id);
  }

  @ApiOperation({
    summary: 'Deactivate a mechanic (ADMIN)',
    description: 'Cannot be assigned to new maintenances; the history is kept.',
  })
  @ApiNotFoundResponse({ description: 'Mechanic not found' })
  @Patch(':id/deactivate')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.mechanics.deactivate(id);
  }
}
