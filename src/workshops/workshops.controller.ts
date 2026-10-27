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
import { WorkshopsService } from './workshops.service.js';
import { CreateWorkshopDto } from './dto/create-workshop.dto.js';
import { UpdateWorkshopDto } from './dto/update-workshop.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enums.js';

@ApiTags('Workshops')
@ApiBearerAuth()
@Controller('workshops')
export class WorkshopsController {
  constructor(private readonly workshops: WorkshopsService) {}

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateWorkshopDto) {
    return this.workshops.create(dto);
  }

  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @Get()
  findActive() {
    return this.workshops.findActive();
  }

  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.workshops.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkshopDto,
  ) {
    return this.workshops.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/activate')
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.workshops.activate(id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/deactivate')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.workshops.deactivate(id);
  }
}
