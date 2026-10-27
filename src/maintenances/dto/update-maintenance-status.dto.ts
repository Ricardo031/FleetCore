import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { MaintenanceStatus } from '../../common/enums/maintenance-status.enum.js';
import { Type } from 'class-transformer';

export class UpdateMaintenanceStatusDto {
  @ApiProperty({
    enum: MaintenanceStatus,
    example: MaintenanceStatus.IN_PROGRESS,
  })
  @IsEnum(MaintenanceStatus)
  status: MaintenanceStatus;

  @ApiPropertyOptional({
    example: 'Cambio de aceite y filtros',
    description: 'Required to COMPLETE',
  })
  @IsOptional()
  @IsString()
  workDone?: string;

  @ApiPropertyOptional({ example: 350000, description: 'Required to COMPLETE' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  finalCost?: number;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: '2026-11-03T09:00:00Z',
    description: 'Required to COMPLETE',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  finishedAt?: Date;

  @ApiPropertyOptional({ example: 45050, description: 'Required to COMPLETE' })
  @IsOptional()
  @IsInt()
  @Min(0)
  finalMileage?: number;
}
