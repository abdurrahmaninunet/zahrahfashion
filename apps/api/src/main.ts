import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.ADMIN_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  // Local stand-in for S3/CloudFront: serve uploaded media from disk.
  app.useStaticAssets(join(process.cwd(), process.env.UPLOADS_DIR ?? './uploads'), {
    prefix: '/uploads/',
  });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Zahrah API listening on http://localhost:${port}/api`);
}

bootstrap();
