import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // apps/web (Vite, port 5173) and apps/api (port 3000) are different origins even in
  // local dev, so the browser blocks requests without this — v1 is local/single-user
  // with no auth (spec §3), so allowing any origin costs nothing yet.
  app.enableCors();
  // whitelist strips unknown body fields; transform turns plain JSON into DTO class
  // instances so the class-validator decorators on them actually run.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
