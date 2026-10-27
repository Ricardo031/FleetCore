import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mechanic } from './entities/mechanics.entity.js';
import { Maintenance } from '../maintenances/entities/maintenaces.entity.js';
import { CreateMechanicDto } from './dto/create-mechanic.dto.js';
import { UpdateMechanicDto } from './dto/update-mechanic.dto.js';
import { UsersService } from '../users/users.service.js';
import { EntityStatus } from '../common/enums/entity-status.enum.js';
import { Role } from '../common/enums/role.enums.js';

@Injectable()
export class MechanicsService {
  constructor(
    @InjectRepository(Mechanic) private readonly repo: Repository<Mechanic>,
    @InjectRepository(Maintenance)
    private readonly maintenances: Repository<Maintenance>,
    private readonly users: UsersService,
  ) {}

  async create({ userId, ...data }: CreateMechanicDto) {
    await this.ensureEmailIsFree(data.email);
    const user = userId ? await this.getLinkableUser(userId) : null;
    return this.repo.save(this.repo.create({ ...data, user }));
  }

  findAll() {
    return this.repo.find({ relations: { user: true }, order: { id: 'ASC' } });
  }

  async findOne(id: number) {
    const mechanic = await this.repo.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!mechanic) throw new NotFoundException(`Mechanic ${id} not found`);
    return mechanic;
  }

  async update(id: number, { userId, ...data }: UpdateMechanicDto) {
    const mechanic = await this.findOne(id);

    if (data.email && data.email !== mechanic.email)
      await this.ensureEmailIsFree(data.email);

    if (userId !== undefined && userId !== mechanic.user?.id)
      mechanic.user = await this.getLinkableUser(userId, mechanic.id);

    Object.assign(mechanic, data);
    return this.repo.save(mechanic);
  }

  activate(id: number) {
    return this.setStatus(id, EntityStatus.ACTIVE);
  }

  // Only changes the status: the maintenance history is never deleted
  deactivate(id: number) {
    return this.setStatus(id, EntityStatus.INACTIVE);
  }

  async findMaintenances(id: number) {
    await this.findOne(id);
    return this.maintenances.find({
      where: { mechanic: { id } },
      relations: { vehicle: true, workshop: true },
      order: { scheduledAt: 'DESC' },
    });
  }

  private async setStatus(id: number, status: EntityStatus) {
    const mechanic = await this.findOne(id);
    mechanic.status = status;
    return this.repo.save(mechanic);
  }

  private async ensureEmailIsFree(email: string) {
    if (await this.repo.exists({ where: { email } }))
      throw new ConflictException(`Email ${email} is already registered`);
  }

  // The user must exist, be a TECHNICIAN and not be linked to another mechanic
  private async getLinkableUser(userId: number, mechanicId?: number) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (user.role !== Role.TECHNICIAN)
      throw new BadRequestException(
        `User ${userId} must have the TECHNICIAN role`,
      );

    const linked = await this.repo.findOne({
      where: { user: { id: userId } },
    });
    if (linked && linked.id !== mechanicId)
      throw new ConflictException(
        `User ${userId} is already linked to mechanic ${linked.id}`,
      );
    return user;
  }
}
