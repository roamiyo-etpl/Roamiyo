import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { HotelBookService } from './book.service';
import { ApiHeaders, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HotelBookInitiateResponse } from './interfaces/book-initiate-response.interface';
import {
    DEC_HEADER_API_VERSION_MANDATE,
    DEC_HEADER_CURRENCY_PREFERENCE_MANDATE,
    DEC_HEADER_IP_ADDRESS_MANDATE,
    SWG_HEADER_API_VERSION_MANDATE,
    SWG_HEADER_CURRENCY_PREFERENCE,
    SWG_HEADER_IP_MANDATE,
} from 'src/shared/constants/standard-api-headers.constant';
import { SWG_BAD_REQUEST_RESPONSE, SWG_INTERNAL_SERVER_ERROR_RESPONSE, SWG_NOT_FOUND_RESPONSE, SWG_UNPROCESSABLE_RESPONSE } from 'src/shared/constants/standard-api-responses.constant';
import { RequiredHeaders } from 'src/shared/decorators/common/custom-header.decorator';
import { HotelBookInitiateDto } from './dtos/hotel-book-initiate.dto';
import { HotelBookConfirmationResponse } from './interfaces/book-confirmation-response.interface';
import { HotelBookConfirmationDto } from './dtos/hotel-book-confirmation.dto';

@ApiHeaders([SWG_HEADER_CURRENCY_PREFERENCE, SWG_HEADER_IP_MANDATE, SWG_HEADER_API_VERSION_MANDATE])
@RequiredHeaders([DEC_HEADER_IP_ADDRESS_MANDATE, DEC_HEADER_API_VERSION_MANDATE, DEC_HEADER_CURRENCY_PREFERENCE_MANDATE])
@ApiTags('Hotel')
@Controller('hotel/book')
export class HotelBookController {
    constructor(private readonly bookService: HotelBookService) {}

    /**
     * [@Description: Initiate hotel book]
     * @author: Pravin Suthar at 2025-10-06
     */
    @Post('initiate')
    @ApiOperation({
        summary: 'Initiate hotel book',
        description: 'Retrieves available room types, rates, and pricing information for a specific hotel based on check-in/check-out dates and guest requirements.',
    })
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @HttpCode(HttpStatus.OK)
    async initiate(@Body() bookDto: HotelBookInitiateDto, @Headers() headers): Promise<HotelBookInitiateResponse> {
        return await this.bookService.initiate(bookDto, headers);
    }

    /**
     * [@Description: Book hotel]
     * @author: Pravin Suthar at 2025-10-06
     */
    @Post('confirmation')
    @ApiOperation({
        summary: 'Hotel book confirmation',
        description: 'Retrieves available room types, rates, and pricing information for a specific hotel based on check-in/check-out dates and guest requirements.',
    })
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @HttpCode(HttpStatus.OK)
    bookConfirmation(@Body() bookDto: HotelBookConfirmationDto): Promise<HotelBookConfirmationResponse> {
        return this.bookService.bookConfirmation(bookDto);
    }
}
