import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { CollectionsService } from './collections.service';
import { Cap } from '../auth/decorators';
import { parse } from '../common/zod';

const nameSchema = z.object({ name: z.string().min(1).max(120) });

/** Admin collections CRUD. */
@Controller('collections')
export class CollectionsController {
  constructor(private collections: CollectionsService) {}

  @Get()
  @Cap('products.view')
  list() {
    return this.collections.list();
  }

  @Post()
  @Cap('products.manage_categories')
  create(@Body() body: unknown) {
    const { name } = parse(nameSchema, body);
    return this.collections.create(name);
  }

  @Put(':id')
  @Cap('products.manage_categories')
  rename(@Param('id') id: string, @Body() body: unknown) {
    const { name } = parse(nameSchema, body);
    return this.collections.rename(id, name);
  }

  @Delete(':id')
  @Cap('products.manage_categories')
  remove(@Param('id') id: string) {
    return this.collections.remove(id);
  }
}
