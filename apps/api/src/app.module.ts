import { Module } from '@nestjs/common';
import { CapturesModule } from './captures/captures.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, HealthModule, CapturesModule],
})
export class AppModule {}
