import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateComplaintDto {
  @ApiProperty({ example: 'worker-uuid' })
  @IsUUID('4', { message: 'workerId must be a valid UUID' })
  workerId: string;

  @ApiProperty({ example: 'Overcharged / fraudulent pricing' })
  @IsNotEmpty()
  @IsString()
  @MinLength(5, { message: 'Reason must be at least 5 characters' })
  @MaxLength(1000, { message: 'Reason must be at most 1000 characters' })
  reason: string;
}
