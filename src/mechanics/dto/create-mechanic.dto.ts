import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateMechanicDto {
  @ApiProperty({ example: 'Carlos Pérez' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'carlos@fleetcore.com' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Motor' })
  @IsString()
  @IsNotEmpty()
  specialty: string;

  // Links the mechanic to a TECHNICIAN user so they can see their maintenances
  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  userId?: number;
}
