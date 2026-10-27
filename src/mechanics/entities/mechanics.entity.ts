import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityStatus } from '../../common/enums/entity-status.enum.js';
import { User } from '../../users/entities/user.entity.js';
import { Maintenance } from '../../maintenances/entities/maintenaces.entity.js';

@Entity('mechanics')
export class Mechanic {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column({ unique: true }) email: string;
  @Column() specialty: string;
  @Column({ type: 'enum', enum: EntityStatus, default: EntityStatus.ACTIVE })
  status: EntityStatus;
  @OneToOne(() => User, { nullable: true }) @JoinColumn() user: User | null;
  @OneToMany(() => Maintenance, (m) => m.mechanic) maintenances: Maintenance[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
