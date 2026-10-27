import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workshop } from './entities/workshops.entity.js';
import { CreateWorkshopDto } from './dto/create-workshop.dto.js';
import { UpdateWorkshopDto } from './dto/update-workshop.dto.js';
import { EntityStatus } from '../common/enums/entity-status.enum.js';

@Injectable()
export class WorkshopsService {
  constructor(
    @InjectRepository(Workshop) private readonly repo: Repository<Workshop>,
  ) {}

  create(dto: CreateWorkshopDto) {
    return this.repo.save(this.repo.create(dto));
  }

  // The public listing only shows workshops that can receive maintenances
  findActive() {
    return this.repo.find({
      where: { status: EntityStatus.ACTIVE },
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number) {
    const workshop = await this.repo.findOne({ where: { id } });
    if (!workshop) throw new NotFoundException(`Workshop ${id} not found`);
    return workshop;
  }

  async update(id: number, dto: UpdateWorkshopDto) {
    const workshop = await this.findOne(id);
    Object.assign(workshop, dto);
    return this.repo.save(workshop);
  }

  activate(id: number) {
    return this.setStatus(id, EntityStatus.ACTIVE);
  }

  deactivate(id: number) {
    return this.setStatus(id, EntityStatus.INACTIVE);
  }

  private async setStatus(id: number, status: EntityStatus) {
    const workshop = await this.findOne(id);
    workshop.status = status;
    return this.repo.save(workshop);
  }
}
