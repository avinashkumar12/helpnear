import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { WorkerStatus } from '@prisma/client';

export class UpdateStatusDto {
  @ApiProperty({ enum: WorkerStatus, example: WorkerStatus.AVAILABLE })
  @IsEnum(WorkerStatus)
  status: WorkerStatus;
}
