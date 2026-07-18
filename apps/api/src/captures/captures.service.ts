import type { CaptureDto } from '@devbrain/shared';
import { Injectable } from '@nestjs/common';
import { toCaptureDto } from './capture.mapper';
import type { CreateCaptureDto } from './dto/create-capture.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CapturesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCaptureDto): Promise<CaptureDto> {
    const capture = await this.prisma.capture.create({
      data: { source: dto.source, task: dto.task, rawText: dto.rawText },
    });
    return toCaptureDto(capture);
  }
}
