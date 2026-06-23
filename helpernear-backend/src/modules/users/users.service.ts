import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async submitComplaint(reporterId: string, workerId: string, reason: string) {
    const worker = await this.prisma.workerProfile.findUnique({ where: { id: workerId } });
    if (!worker) throw new NotFoundException('Worker not found');
    const existing = await this.prisma.complaint.findFirst({
      where: { reporterId, workerId, status: 'PENDING' },
    });
    if (existing) throw new BadRequestException('You already have a pending complaint against this worker');
    return this.prisma.complaint.create({
      data: { reporterId, workerId, reason },
      select: { id: true, status: true, createdAt: true },
    });
  }

  async saveFcmToken(userId: string, token: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { fcmToken: token } });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
