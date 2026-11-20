import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateReviewDto) {
    const worker = await this.prisma.workerProfile.findUnique({
      where: { id: dto.workerId },
    });
    if (!worker) throw new NotFoundException('Worker not found');

    if (worker.userId === userId) {
      throw new BadRequestException('You cannot review yourself');
    }

    // Only customers who actually contacted this worker may review them
    const contacted = await this.prisma.contactLog.findFirst({
      where: { workerId: dto.workerId, userId },
      select: { id: true },
    });
    if (!contacted) {
      throw new ForbiddenException(
        'Please contact this worker before leaving a review',
      );
    }

    const existing = await this.prisma.review.findFirst({
      where: { workerId: dto.workerId, userId },
    });
    if (existing) {
      throw new BadRequestException(
        'You have already reviewed this worker',
      );
    }

    return this.prisma.review.create({
      data: {
        workerId: dto.workerId,
        userId,
        rating: dto.rating,
        comment: dto.comment,
      },
      include: {
        user: { select: { name: true } },
      },
    });
  }

  async getWorkerReviews(workerId: string) {
    const worker = await this.prisma.workerProfile.findUnique({
      where: { id: workerId },
    });
    if (!worker) throw new NotFoundException('Worker not found');

    return this.prisma.review.findMany({
      where: { workerId },
      include: {
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getWorkerAverageRating(workerId: string) {
    const agg = await this.prisma.review.aggregate({
      where: { workerId },
      _avg: { rating: true },
      _count: { rating: true },
    });
    return {
      averageRating: agg._avg.rating ?? 0,
      totalReviews: agg._count.rating,
    };
  }
}
