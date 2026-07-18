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

  describe('GET /captures', () => {
    // Seeded directly via Prisma (not POST /captures) so ordering + a non-'raw' status
    // can be controlled deterministically instead of racing on wall-clock timestamps.
    let oldestRawId: string;
    let distilledId: string;
    let newestRawId: string;

    beforeAll(async () => {
      const now = Date.now();
      const oldestRaw = await prisma.capture.create({
        data: {
          source: 'e2e-test-list',
          rawText: 'oldest raw',
          status: 'raw',
          createdAt: new Date(now - 2000),
        },
      });
      const distilled = await prisma.capture.create({
        data: {
          source: 'e2e-test-list',
          rawText: 'a distilled one',
          status: 'distilled',
          createdAt: new Date(now - 1000),
        },
      });
      const newestRaw = await prisma.capture.create({
        data: {
          source: 'e2e-test-list',
          rawText: 'newest raw',
          status: 'raw',
          createdAt: new Date(now),
        },
      });
      oldestRawId = oldestRaw.id;
      distilledId = distilled.id;
      newestRawId = newestRaw.id;
    });

    afterAll(async () => {
      await prisma.capture.deleteMany({ where: { source: 'e2e-test-list' } });
    });

    it('?status=raw returns only raw captures, newest first', async () => {
      const res = await request(app.getHttpServer()).get('/captures?status=raw').expect(200);
      const ids = (res.body as { id: string }[])
        .map((c) => c.id)
        .filter((id) => id === oldestRawId || id === newestRawId);

      expect(ids).toEqual([newestRawId, oldestRawId]);
      expect((res.body as { id: string }[]).some((c) => c.id === distilledId)).toBe(false);
    });

    it('no status query returns every capture, still newest first among ours', async () => {
      const res = await request(app.getHttpServer()).get('/captures').expect(200);
      const ids = (res.body as { id: string }[])
        .map((c) => c.id)
        .filter((id) => id === oldestRawId || id === distilledId || id === newestRawId);

      expect(ids).toEqual([newestRawId, distilledId, oldestRawId]);
    });

    it('an invalid status value is rejected with 400', async () => {
      await request(app.getHttpServer()).get('/captures?status=bogus').expect(400);
    });
  });
});
