import { Injectable } from '@nestjs/common';
// import { HotelbedsBookService } from './hotelbeds/hotelbeds-book.service';
import { HotelBookConfirmationDto } from '../book/dtos/hotel-book-confirmation.dto';
import { HotelBookConfirmationResponse } from '../book/interfaces/book-confirmation-response.interface';

@Injectable()
export class ProviderBookService {
    constructor() {} // private readonly hotelbedsBookService: HotelbedsBookService

    async bookConfirmation(bookDto: HotelBookConfirmationDto): Promise<HotelBookConfirmationResponse> {
        // return this.hotelbedsBookService.bookConfirmation(bookDto);
        // return new HotelBookConfirmationResponse();
        return new HotelBookConfirmationResponse();
    }
}
