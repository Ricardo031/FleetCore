import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateWorkshopDto {
  @ApiProperty({ example: 'Taller Centro' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Calle 45 # 20-10' })
  @IsString()
  @IsNotEmpty()
  address: string;
}
