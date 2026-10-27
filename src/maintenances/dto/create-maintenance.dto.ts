import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { MaintenanceType } from '../../common/enums/maintenance-type.enum.js';

export class CreateMaintenanceDto {
  @ApiProperty({ enum: MaintenanceType })
  @IsEnum(MaintenanceType)
  type: MaintenanceType;

  @ApiProperty({ example: 'Cambio de aceite y filtros' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 45100 })
  @IsInt()
  @Min(0)
  mileage: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-03T12:30:00Z',
  })
  @Type(() => Date)
  @IsDate()
  scheduledAt: Date;

  @ApiPropertyOptional({ example: 90, description: 'Default: 60 minutes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes?: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  vehicleId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  mechanicId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  workshopId: number;
}
