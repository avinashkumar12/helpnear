import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateComplaintDto } from './dto/create-complaint.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: { id: string }) {
    const data = await this.usersService.getMe(user.id);
    return { message: 'Profile retrieved successfully', data };
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProfileDto,
  ) {
    const data = await this.usersService.updateProfile(user.id, dto);
    return { message: 'Profile updated successfully', data };
  }

  @Post('fcm-token')
  @HttpCode(200)
  async saveFcmToken(@CurrentUser() user: { id: string }, @Body() body: { token: string }) {
    if (body.token) await this.usersService.saveFcmToken(user.id, body.token);
    return { message: 'FCM token saved' };
  }

  @Post('complaints')
  async submitComplaint(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateComplaintDto,
  ) {
    const data = await this.usersService.submitComplaint(user.id, dto.workerId, dto.reason);
    return { message: 'Complaint submitted. Our team will review it within 24 hours.', data };
  }
}
