import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

@ApiTags('Reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('reviews')
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreateReviewDto) {
    const data = await this.reviewsService.create(user.id, dto);
    return { message: 'Review submitted successfully', data };
  }

  @Get('workers/:id/reviews')
  async getWorkerReviews(@Param('id') id: string) {
    const data = await this.reviewsService.getWorkerReviews(id);
    return { message: 'Reviews retrieved successfully', data };
  }
}
