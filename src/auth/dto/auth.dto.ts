import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '../../common/enums/role.enums.js';

export class RegisterDto {
  @ApiProperty({ example: 'Carlos Pérez' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'carlos.perez@fleetcore.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Tech123*', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: Role, example: Role.TECHNICIAN })
  @IsEnum(Role)
  role: Role;
}

export class LoginDto {
  @ApiProperty({ example: 'admin@fleetcore.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin123*' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
