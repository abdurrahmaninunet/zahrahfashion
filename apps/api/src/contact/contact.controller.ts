import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { Cap } from '../auth/decorators';
import { parse } from '../common/zod';
import { ContactService } from './contact.service';

/** Admin — the storefront contact inbox (one-way). List messages, mark read. */
@Controller('contact')
export class ContactController {
  constructor(private contact: ContactService) {}

  @Get()
  @Cap('customers.view')
  list(@Query('status') status?: string, @Query('page') page?: string) {
    return this.contact.list({ status, page: Number(page) || 1 });
  }

  @Put(':id')
  @Cap('customers.view')
  setStatus(@Param('id') id: string, @Body() body: unknown) {
    const { status } = parse(z.object({ status: z.enum(['new', 'read']) }), body);
    return this.contact.setStatus(id, status);
  }
}
