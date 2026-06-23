import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class WorkersService {
  constructor(private readonly prisma: PrismaService) {}

  async getNearby(lat: number, lng: number, radiusKm: number, categoryId?: string) {
    const workers = await this.prisma.workerProfile.findMany({
      where: {
        isVerified: true,
        status: 'AVAILABLE',
        ...(categoryId && {
          categories: { some: { categoryId } },
        }),
      },
      include: {
        categories: { include: { category: true } },
        user: { select: { id: true, name: true, phone: true } },
        reviews: { select: { rating: true }, take: 100 },
      },
    });

    return workers
      .map((w) => {
        const distance = haversineKm(lat, lng, Number(w.latitude ?? 0), Number(w.longitude ?? 0));
        const ratings = w.reviews.map((r) => r.rating);
        const averageRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
        return { ...w, distance, averageRating, reviewCount: ratings.length };
      })
      .filter((w) => w.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
  }

  async createProfile(userId: string, dto: CreateWorkerDto) {
    const existing = await this.prisma.workerProfile.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new BadRequestException('Worker profile already exists');
    }

    return this.prisma.workerProfile.create({
      data: {
        userId,
        bio: dto.bio,
        experienceYears: dto.experienceYears ?? 0,
        priceRange: dto.priceRange,
        latitude: dto.latitude,
        longitude: dto.longitude,
        categories: {
          create: dto.categoryIds.map((categoryId) => ({ categoryId })),
        },
      },
      include: {
        categories: { include: { category: true } },
        user: { select: { id: true, name: true, phone: true, role: true } },
      },
    });
  }

  async getMyProfile(userId: string) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId },
      include: {
        categories: { include: { category: true } },
        user: { select: { id: true, name: true, phone: true, role: true } },
      },
    });
    if (!profile) throw new NotFoundException('Worker profile not found');
    return profile;
  }

  async getWorkerById(workerId: string, viewerUserId?: string) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { id: workerId },
      include: {
        categories: { include: { category: true } },
        user: { select: { id: true, name: true, phone: true } },
        reviews: {
          select: { rating: true, comment: true, createdAt: true, user: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!profile) throw new NotFoundException('Worker not found');

    const [agg, hasReviewed] = await Promise.all([
      this.prisma.review.aggregate({
        where: { workerId },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      viewerUserId
        ? this.prisma.review.findFirst({ where: { workerId, userId: viewerUserId }, select: { id: true } }).then(Boolean)
        : Promise.resolve(false),
    ]);

    return {
      ...profile,
      averageRating: agg._avg.rating ?? 0,
      reviewCount: agg._count.rating,
      hasReviewed,
    };
  }

  async updateProfile(userId: string, dto: UpdateWorkerDto) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Worker profile not found');

    const { categoryIds, ...rest } = dto;

    if (categoryIds) {
      await this.prisma.workerCategory.deleteMany({
        where: { workerId: profile.id },
      });
    }

    return this.prisma.workerProfile.update({
      where: { userId },
      data: {
        ...rest,
        ...(categoryIds && {
          categories: {
            create: categoryIds.map((categoryId) => ({ categoryId })),
          },
        }),
      },
      include: {
        categories: { include: { category: true } },
      },
    });
  }

  async updateLocation(userId: string, dto: UpdateLocationDto) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Worker profile not found');

    return this.prisma.workerProfile.update({
      where: { userId },
      data: { latitude: dto.latitude, longitude: dto.longitude },
      select: { id: true, latitude: true, longitude: true, updatedAt: true },
    });
  }

  async updateStatus(userId: string, dto: UpdateStatusDto) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Worker profile not found');

    return this.prisma.workerProfile.update({
      where: { userId },
      data: { status: dto.status },
      select: { id: true, status: true, updatedAt: true },
    });
  }

  async updatePhotoUrl(userId: string, photoUrl: string) {
    return this.prisma.workerProfile.update({
      where: { userId },
      data: { photoUrl },
      select: { id: true, photoUrl: true },
    });
  }

  async logContact(workerId: string, channel: string, userId?: string) {
    const worker = await this.prisma.workerProfile.findUnique({ where: { id: workerId }, select: { id: true } });
    if (!worker) throw new NotFoundException('Worker not found');
    return this.prisma.contactLog.create({
      data: { workerId, channel, userId: userId ?? null },
      select: { id: true, channel: true, createdAt: true },
    });
  }

  async getContactStats(userId: string) {
    const profile = await this.prisma.workerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) throw new NotFoundException('Worker profile not found');

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek  = new Date(startOfToday); startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOf30    = new Date(now); startOf30.setDate(now.getDate() - 30);

    const [total, todayCount, weekCount, monthCount, byChannel, recent] = await Promise.all([
      this.prisma.contactLog.count({ where: { workerId: profile.id } }),
      this.prisma.contactLog.count({ where: { workerId: profile.id, createdAt: { gte: startOfToday } } }),
      this.prisma.contactLog.count({ where: { workerId: profile.id, createdAt: { gte: startOfWeek } } }),
      this.prisma.contactLog.count({ where: { workerId: profile.id, createdAt: { gte: startOf30 } } }),
      this.prisma.contactLog.groupBy({ by: ['channel'], where: { workerId: profile.id }, _count: { channel: true } }),
      this.prisma.contactLog.findMany({
        where: { workerId: profile.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, channel: true, createdAt: true, user: { select: { name: true } } },
      }),
    ]);

    const channelMap: Record<string, number> = {};
    byChannel.forEach(r => { channelMap[r.channel] = r._count.channel; });

    return { total, todayCount, weekCount, monthCount, calls: channelMap['call'] ?? 0, whatsapps: channelMap['whatsapp'] ?? 0, recent };
  }
}
