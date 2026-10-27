import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { MaintenanceType } from '../../common/enums/maintenance-type.enum.js';
import { MaintenanceStatus } from '../../common/enums/maintenance-status.enum.js';
import { Vehicle } from '../../vehicles/entities/vehicle.entity.js';
import { Mechanic } from '../../mechanics/entities/mechanics.entity.js';
import { Workshop } from '../../workshops/entities/workshops.entity.js';

@Entity('maintenances')
export class Maintenance {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'enum', enum: MaintenanceType }) type: MaintenanceType;
  @Column({ type: 'text' }) description: string;
  @Column({ type: 'int' }) mileage: number; // km al programarlo
  @Column({ type: 'timestamptz' }) scheduledAt: Date;
  @Column({ type: 'timestamptz' }) scheduledEndAt: Date; // scheduledAt + durationMinutes
  @Column({
    type: 'enum',
    enum: MaintenanceStatus,
    default: MaintenanceStatus.SCHEDULED,
  })
  status: MaintenanceStatus;

  // Datos de cierre (solo al completar)
  @Column({ type: 'text', nullable: true }) workDone: string | null;
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: { to: (v) => v, from: (v) => (v === null ? null : Number(v)) },
  })
  finalCost: number | null;
  @Column({ type: 'timestamptz', nullable: true }) finishedAt: Date | null;
  @Column({ type: 'int', nullable: true }) finalMileage: number | null;

  @ManyToOne(() => Vehicle, (v) => v.maintenances, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  vehicle: Relation<Vehicle>;
  @ManyToOne(() => Mechanic, (m) => m.maintenances, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  mechanic: Relation<Mechanic>;
  @ManyToOne(() => Workshop, (w) => w.maintenances, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  workshop: Relation<Workshop>;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
