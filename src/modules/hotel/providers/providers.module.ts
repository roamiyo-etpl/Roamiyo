import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProvidersSearchService } from './providers-search.service';
import { ProviderRoomsService } from './providers-rooms.service';
import { HotelbedsSearchService } from './hotelbeds/hotelbeds-search.service';
import { TboSearchService } from './tbo/tbo-search.service';
import { TboRoomService } from './tbo/tbo-room.service';
import { TboRepository } from './tbo/tbo.repository';
import { HotelMasterEntity } from 'src/shared/entities/hotel-master.entity';
import { TboHotelAdditionalDetailsEntity } from 'src/modules/dump/hotel/entities/tbo-hotel-additional-details.entity';
import { TboHotelImagesEntity } from 'src/modules/dump/hotel/entities/tbo-hotel-images.entity';
import { ProviderBookService } from './provider-book.service';

@Module({
    imports: [TypeOrmModule.forFeature([HotelMasterEntity, TboHotelAdditionalDetailsEntity, TboHotelImagesEntity])],
    providers: [ProvidersSearchService, ProviderRoomsService, ProviderBookService, HotelbedsSearchService, TboSearchService, TboRoomService, TboRepository],
    exports: [ProvidersSearchService, ProviderRoomsService, ProviderBookService],
})
export class ProvidersModule {}
