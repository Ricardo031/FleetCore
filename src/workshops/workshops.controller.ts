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
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { WorkshopsService } from './workshops.service.js';
import { CreateWorkshopDto } from './dto/create-workshop.dto.js';
import { UpdateWorkshopDto } from './dto/update-workshop.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enums.js';
import { ApiProtected } from '../common/decorators/api-protected.decorator.js';

@ApiTags('Workshops')
@ApiProtected()
@Controller('workshops')
export class WorkshopsController {
  constructor(private readonly workshops: WorkshopsService) {}

  @ApiOperation({ summary: 'Register a workshop (ADMIN)' })
  @ApiBadRequestResponse({ description: 'Invalid data' })
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateWorkshopDto) {
    return this.workshops.create(dto);
  }

  @ApiOperation({ summary: 'List ACTIVE workshops (ADMIN, TECHNICIAN)' })
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @Get()
  findActive() {
    return this.workshops.findActive();
  }

  @ApiOperation({ summary: 'Find a workshop by id (ADMIN, TECHNICIAN)' })
  @ApiNotFoundResponse({ description: 'Workshop not found' })
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.workshops.findOne(id);
  }

  @ApiOperation({ summary: 'Update a workshop (ADMIN)' })
  @ApiBadRequestResponse({ description: 'Invalid data' })
  @ApiNotFoundResponse({ description: 'Workshop not found' })
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkshopDto,
  ) {
    return this.workshops.update(id, dto);
  }

  @ApiOperation({ summary: 'Activate a workshop (ADMIN)' })
  @ApiNotFoundResponse({ description: 'Workshop not found' })
  @Roles(Role.ADMIN)
  @Patch(':id/activate')
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.workshops.activate(id);
  }

  @ApiOperation({
    summary: 'Deactivate a workshop (ADMIN)',
    description: 'Cannot receive new maintenances; the history is kept.',
  })
  @ApiNotFoundResponse({ description: 'Workshop not found' })
  @Roles(Role.ADMIN)
  @Patch(':id/deactivate')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.workshops.deactivate(id);
  }
}
