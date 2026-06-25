import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({ example: '+919876543210', description: 'Indian mobile number with +91 prefix' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+91\d{10}$/, { message: 'Phone must be a valid Indian number (+91XXXXXXXXXX)' })
  phone: string;
}
