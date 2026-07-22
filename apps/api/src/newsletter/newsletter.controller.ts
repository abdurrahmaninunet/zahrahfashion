import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { Cap } from '../auth/decorators';
import { NewsletterService } from './newsletter.service';

/** Admin — storefront newsletter sign-ups (from the footer). */
@Controller('newsletter')
export class NewsletterController {
  constructor(private newsletter: NewsletterService) {}

  @Get()
  @Cap('customers.view')
  list(@Query('q') q?: string, @Query('page') page?: string) {
    return this.newsletter.list({ q, page: Number(page) || 1 });
  }

  @Delete(':id')
  @Cap('customers.view')
  remove(@Param('id') id: string) {
    return this.newsletter.remove(id);
  }
}
