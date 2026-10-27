import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VehicleStatus } from '../../common/enums/vehicle-status.enums.js';
import { Maintenance } from '../../maintenances/entities/maintenaces.entity.js';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  plate: string;

  @Column()
  brand: string;

  @Column()
  model: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int' }) mileage: number;
  @Column({
    type: 'enum',
    enum: VehicleStatus,
    default: VehicleStatus.AVAILABLE,
  })
  status: VehicleStatus;
  @OneToMany(() => Maintenance, (m) => m.vehicle)
  maintenances: Maintenance[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
