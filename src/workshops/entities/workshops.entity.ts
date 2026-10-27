import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityStatus } from '../../common/enums/entity-status.enum.js';
import { Maintenance } from '../../maintenances/entities/maintenaces.entity.js';

@Entity('workshops')
export class Workshop {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column() address: string;
  @Column({ type: 'enum', enum: EntityStatus, default: EntityStatus.ACTIVE })
  status: EntityStatus;
  @OneToMany(() => Maintenance, (m) => m.workshop) maintenances: Maintenance[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
