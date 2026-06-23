import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WorkersService } from './workers.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@ApiTags('Workers')
@Controller('workers')
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('profile')
  async createProfile(@CurrentUser() user: { id: string }, @Body() dto: CreateWorkerDto) {
    const data = await this.workersService.createProfile(user.id, dto);
    return { message: 'Worker profile created successfully', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('my-profile')
  async getMyProfileAlias(@CurrentUser() user: { id: string }) {
    const data = await this.workersService.getMyProfile(user.id);
    return { message: 'Worker profile retrieved successfully', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getMyProfile(@CurrentUser() user: { id: string }) {
    const data = await this.workersService.getMyProfile(user.id);
    return { message: 'Worker profile retrieved successfully', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(@CurrentUser() user: { id: string }, @Body() dto: UpdateWorkerDto) {
    const data = await this.workersService.updateProfile(user.id, dto);
    return { message: 'Worker profile updated successfully', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('location')
  async updateLocation(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateLocationDto,
  ) {
    const data = await this.workersService.updateLocation(user.id, dto);
    return { message: 'Location updated successfully', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('status')
  async updateStatus(@CurrentUser() user: { id: string }, @Body() dto: UpdateStatusDto) {
    const data = await this.workersService.updateStatus(user.id, dto);
    return { message: 'Status updated successfully', data };
  }

  @Get('nearby')
  async getNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const data = await this.workersService.getNearby(
      parseFloat(lat),
      parseFloat(lng),
      parseFloat(radius) || 5,
      categoryId || undefined,
    );
    return { message: 'Nearby workers fetched', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('profile/photo')
  @UseInterceptors(FileInterceptor('photo', {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        const dir = join(process.cwd(), 'uploads', 'workers');
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
        cb(null, `worker-${unique}${extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (/\.(jpg|jpeg|png|webp)$/i.test(file.originalname)) cb(null, true);
      else cb(new BadRequestException('Only JPG, PNG or WebP allowed'), false);
    },
  }))
  async uploadPhoto(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { id: string },
  ) {
    const photoUrl = `/uploads/workers/${file.filename}`;
    await this.workersService.updatePhotoUrl(user.id, photoUrl);
    return { message: 'Photo uploaded', data: { photoUrl } };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/contact-stats')
  async getContactStats(@CurrentUser() user: { id: string }) {
    const data = await this.workersService.getContactStats(user.id);
    return { message: 'Contact stats retrieved', data };
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async getWorkerById(
    @Param('id') id: string,
    @CurrentUser() user?: { id: string } | null,
  ) {
    const data = await this.workersService.getWorkerById(id, user?.id);
    return { message: 'Worker retrieved successfully', data };
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post(':id/contact')
  async logContact(
    @Param('id') workerId: string,
    @Body() body: { channel: string },
    @CurrentUser() user?: { id: string } | null,
  ) {
    const channel = body.channel === 'whatsapp' ? 'whatsapp' : 'call';
    const data = await this.workersService.logContact(workerId, channel, user?.id);
    return { message: 'Contact logged', data };
  }
}
