import { Module } from '@nestjs/common';
import { SessionModule } from 'src/session/session.module';
import { StaticPagesController } from './static-pages.controller';
import { StaticPagesService } from './static-pages.service';

@Module({
  imports: [SessionModule],
  controllers: [StaticPagesController],
  providers: [StaticPagesService],
  exports: [StaticPagesService],
})
export class StaticPagesModule {}
