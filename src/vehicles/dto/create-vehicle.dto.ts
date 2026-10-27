import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class CreateVehicleDto {
  @ApiProperty({ example: 'ABC123' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  plate: string;

  @ApiProperty({ example: 'Chevrolet' })
  @IsString()
  @IsNotEmpty()
  brand: string;

  @ApiProperty({ example: 'NPR' })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({ example: 2020 })
  @IsInt()
  @Min(1950)
  @Max(new Date().getFullYear() + 1)
  year: number;

  @ApiProperty({ example: 45000 })
  @IsInt()
  @Min(0)
  mileage: number;
}
