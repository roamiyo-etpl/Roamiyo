import { Module } from '@nestjs/common';
import { HotelBookService } from './book.service';
import { HotelBookController } from './book.controller';
import { ProvidersModule } from '../providers/providers.module';

@Module({
    imports: [ProvidersModule],
    providers: [HotelBookService],
    controllers: [HotelBookController],
})
export class HotelBookModule { }