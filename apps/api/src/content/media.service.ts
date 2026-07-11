import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaService } from '../prisma/prisma.service';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE = 8 * 1024 * 1024; // 8MB
const RENDITION_WIDTHS = [480, 960, 1600];

/**
 * Media library — FR-MED. Stores originals + WebP renditions.
 *
 * Storage backend is chosen by env:
 *  - Production: **S3** (set S3_MEDIA_BUCKET + AWS_REGION) served via CloudFront
 *    (set MEDIA_PUBLIC_URL to the CDN origin, e.g. https://cdn.zahrahfashion.com).
 *    Credentials come from the ECS task role (no keys in code).
 *  - Development: local disk under ./uploads, served at /uploads/ (default).
 * The stored URL contract is identical either way (absolute CDN URL vs /uploads path).
 */
@Injectable()
export class MediaService {
  private readonly s3: S3Client | null;
  private readonly bucket = process.env.S3_MEDIA_BUCKET;

  constructor(private prisma: PrismaService) {
    this.s3 = this.bucket ? new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' }) : null;
  }

  private get uploadsDir() {
    return join(process.cwd(), process.env.UPLOADS_DIR ?? './uploads');
  }

  /** Public base for stored objects: CloudFront CDN, else the S3 URL, else '' (local). */
  private get publicBase() {
    const cdn = process.env.MEDIA_PUBLIC_URL?.replace(/\/$/, '');
    if (cdn) return cdn;
    if (this.bucket) return `https://${this.bucket}.s3.${process.env.AWS_REGION ?? 'us-east-1'}.amazonaws.com`;
    return '';
  }

  /** Persist one object and return its public URL (S3 when configured, else disk). */
  private async store(key: string, buffer: Buffer, contentType: string): Promise<string> {
    if (this.s3) {
      await this.s3.send(new PutObjectCommand({
        Bucket: this.bucket!,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }));
      return `${this.publicBase}/${key}`;
    }
    const path = join(this.uploadsDir, key);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, buffer);
    return `/uploads/${key}`;
  }

  async upload(userId: string, file: { originalname: string; mimetype: string; size: number; buffer: Buffer }, baseAlt?: string, tags?: string[]) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Only JPG, PNG and WebP images are allowed (FR-MED-04)');
    }
    if (file.size > MAX_SIZE) throw new BadRequestException('Image exceeds the 8MB limit');

    const contentHash = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.prisma.mediaAsset.findUnique({
      where: { contentHash },
      include: { renditions: true },
    });
    if (existing) return existing; // dedup by content hash

    const meta = await sharp(file.buffer).metadata();
    const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const baseName = contentHash.slice(0, 16);

    const url = await this.store(`media/${baseName}.${ext}`, file.buffer, file.mimetype);

    const asset = await this.prisma.mediaAsset.create({
      data: {
        filename: file.originalname,
        contentHash,
        mime: file.mimetype,
        width: meta.width ?? null,
        height: meta.height ?? null,
        sizeBytes: file.size,
        url,
        baseAlt: baseAlt ?? null,
        tags: tags ?? [],
        uploadedBy: userId,
      },
    });

    // WebP renditions (FR-MED-02 pipeline).
    for (const width of RENDITION_WIDTHS) {
      if (meta.width && meta.width <= width) continue;
      const buffer = await sharp(file.buffer).resize({ width }).webp({ quality: 82 }).toBuffer();
      const renditionUrl = await this.store(`media/${baseName}-w${width}.webp`, buffer, 'image/webp');
      await this.prisma.mediaRendition.create({
        data: { assetId: asset.id, width, format: 'webp', url: renditionUrl },
      });
    }

    return this.prisma.mediaAsset.findUnique({ where: { id: asset.id }, include: { renditions: true } });
  }

  async list(params: { q?: string; tag?: string; page?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = 40;
    const where = {
      ...(params.q ? { filename: { contains: params.q, mode: 'insensitive' as const } } : {}),
      ...(params.tag ? { tags: { has: params.tag } } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.mediaAsset.count({ where }),
      this.prisma.mediaAsset.findMany({
        where,
        include: { renditions: true, _count: { select: { usages: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, rows };
  }

  /** Validation 5: deletion blocked while used. */
  async remove(id: string) {
    const usages = await this.prisma.mediaUsage.count({ where: { assetId: id } });
    const productUse = await this.prisma.productMedia.count({
      where: { url: { contains: (await this.prisma.mediaAsset.findUniqueOrThrow({ where: { id } })).contentHash.slice(0, 16) } },
    });
    if (usages > 0 || productUse > 0) {
      throw new BadRequestException(`This image is used in ${usages + productUse} place(s) — remove those usages first`);
    }
    await this.prisma.mediaRendition.deleteMany({ where: { assetId: id } });
    await this.prisma.mediaAsset.delete({ where: { id } });
    return { deleted: true };
  }
}
