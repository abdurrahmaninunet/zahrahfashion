import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { Cap } from '../auth/decorators';
import { parse } from '../common/zod';
import { ReviewsService } from './reviews.service';

/** Admin review moderation — the "Comments" tab. Lists every review (with the
 *  reviewer's contact) and toggles visibility. */
@Controller('reviews')
export class ReviewsController {
  constructor(private reviews: ReviewsService) {}

  @Get()
  @Cap('products.create_edit')
  list(@Query('status') status?: string, @Query('page') page?: string) {
    return this.reviews.adminList({ status, page: Number(page) || 1 });
  }

  @Put(':id')
  @Cap('products.create_edit')
  setStatus(@Param('id') id: string, @Body() body: unknown) {
    const { status } = parse(z.object({ status: z.enum(['visible', 'hidden']) }), body);
    return this.reviews.setStatus(id, status);
  }
}
