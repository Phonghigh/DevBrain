import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Captures (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    prisma = moduleRef.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await prisma.capture.deleteMany({ where: { source: 'e2e-test' } });
    await app.close();
  });

  it('POST /captures creates a capture with status=raw', async () => {
    const res = await request(app.getHttpServer())
      .post('/captures')
      .send({ source: 'e2e-test', task: 'writing an e2e test', rawText: 'raw dump text' })
      .expect(201);

    expect(res.body).toMatchObject({
      source: 'e2e-test',
      task: 'writing an e2e test',
      rawText: 'raw dump text',
      status: 'raw',
    });
    expect(typeof res.body.id).toBe('string');
    expect(typeof res.body.createdAt).toBe('string');

    const stored = await prisma.capture.findUnique({ where: { id: res.body.id } });
    expect(stored?.status).toBe('raw');
  });

  it('POST /captures without task still succeeds (task is optional)', async () => {
    const res = await request(app.getHttpServer())
      .post('/captures')
      .send({ source: 'e2e-test', rawText: 'raw dump text, no task' })
      .expect(201);

    expect(res.body.task).toBeNull();
  });

  it('POST /captures rejects a missing rawText with 400', async () => {
    await request(app.getHttpServer()).post('/captures').send({ source: 'e2e-test' }).expect(400);
  });

  it('POST /captures strips unknown fields instead of persisting them', async () => {
    const res = await request(app.getHttpServer())
      .post('/captures')
      .send({ source: 'e2e-test', rawText: 'raw dump text', status: 'distilled' })
      .expect(201);

    expect(res.body.status).toBe('raw');
  });
});
