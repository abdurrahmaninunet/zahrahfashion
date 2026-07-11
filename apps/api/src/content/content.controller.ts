import {
  BadRequestException, Body, Controller, Delete, Get, OnModuleInit, Param, Post, Put, Query, Req,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { ContentService } from './content.service';
import { MediaService } from './media.service';
import { PrismaService } from '../prisma/prisma.service';
import { Cap } from '../auth/decorators';
import { AuthedRequest } from '../auth/auth.types';
import { parse } from '../common/zod';
import { SECTION_TYPES } from './section-types';

const createSchema = z.object({
  type: z.enum(['section', 'page', 'menu', 'announcement', 'collection']),
  sectionKey: z.string().optional(),
  title: z.string().min(1).max(200),
  fields: z.record(z.unknown()).optional(),
  slug: z.string().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  promotionId: z.string().nullable().optional(),
  seo: z.record(z.unknown()).optional(),
});

@Controller('content')
export class ContentController implements OnModuleInit {
  constructor(
    private content: ContentService,
    private media: MediaService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.content.seedSystemPages();
  }

  @Get('section-types')
  @Cap('content.edit_publish')
  sectionTypes() {
    return SECTION_TYPES;
  }

  @Get('items')
  @Cap('content.edit_publish')
  list(@Query('type') type?: string, @Query('status') status?: string, @Query('q') q?: string) {
    return this.content.list({ type, status, q });
  }

  @Get('items/:id')
  @Cap('content.edit_publish')
  detail(@Param('id') id: string) {
    return this.content.detail(id);
  }

  @Post('items')
  @Cap('content.edit_publish')
  create(@Body() body: unknown, @Req() req: AuthedRequest) {
    return this.content.create(req.user, parse(createSchema, body) as never);
  }

  @Put('items/:id')
  @Cap('content.edit_publish')
  update(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    return this.content.update(req.user, id, body as Record<string, unknown>);
  }

  @Post('items/:id/publish')
  @Cap('content.edit_publish')
  publish(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.content.publish(req.user, id);
  }

  @Post('items/:id/unpublish')
  @Cap('content.edit_publish')
  unpublish(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.content.unpublish(req.user, id);
  }

  @Delete('items/:id')
  @Cap('content.edit_publish')
  archive(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.content.archive(req.user, id);
  }

  // ── Homepage composition ───────────────────────────────────────────────────

  @Get('composition/:surface')
  @Cap('content.edit_publish')
  composition(@Param('surface') surface: string) {
    return this.content.getComposition(surface);
  }

  @Put('composition/:surface')
  @Cap('content.edit_publish')
  setComposition(@Param('surface') surface: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const { contentItemIds } = parse(z.object({ contentItemIds: z.array(z.string()) }), body);
    return this.content.setComposition(req.user, surface, contentItemIds);
  }

  // ── Media library ──────────────────────────────────────────────────────────

  @Get('media')
  @Cap('content.media')
  mediaList(@Query('q') q?: string, @Query('tag') tag?: string, @Query('page') page?: string) {
    return this.media.list({ q, tag, page: Number(page) || 1 });
  }

  @Post('media')
  @Cap('content.media')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(
    @UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined,
    @Body() body: { baseAlt?: string; tags?: string },
    @Req() req: AuthedRequest,
  ) {
    if (!file) throw new BadRequestException('No file received');
    const tags = body.tags ? body.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
    return this.media.upload(req.user.id, file, body.baseAlt, tags);
  }

  @Delete('media/:id')
  @Cap('content.media')
  removeMedia(@Param('id') id: string) {
    return this.media.remove(id);
  }

  // ── Redirects (D-30) ───────────────────────────────────────────────────────

  @Get('redirects')
  @Cap('content.manage_redirects')
  redirects() {
    return this.prisma.redirect.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }

  @Post('redirects')
  @Cap('content.manage_redirects')
  addRedirect(@Body() body: unknown) {
    const { fromSlug, toSlug } = parse(z.object({ fromSlug: z.string().min(1), toSlug: z.string().min(1) }), body);
    return this.content.addRedirect(fromSlug, toSlug);
  }

  @Delete('redirects/:id')
  @Cap('content.manage_redirects')
  removeRedirect(@Param('id') id: string) {
    return this.prisma.redirect.delete({ where: { id } });
  }

  // ── Needs attention ────────────────────────────────────────────────────────

  @Get('needs-attention')
  @Cap('content.edit_publish')
  needsAttention() {
    return this.prisma.needsAttention.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Post('needs-attention/:id/resolve')
  @Cap('content.edit_publish')
  resolveAttention(@Param('id') id: string) {
    return this.prisma.needsAttention.update({
      where: { id },
      data: { status: 'resolved', resolvedAt: new Date() },
    });
  }

  @Get('audit')
  @Cap('content.view_audit')
  audit(@Query('contentItemId') contentItemId?: string) {
    return this.prisma.contentEvent.findMany({
      where: contentItemId ? { contentItemId } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
