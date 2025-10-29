import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional } from 'class-validator';

export class HotelRoomQuoteDto {
    @IsOptional()
    @ApiPropertyOptional({
        description: 'hotelId received in search result.',
        example: '123423',
    })
    hotelId?: string;

    @ApiProperty({
        description: 'uniqueId/rateKey received in search result.',
        example: '6E823|AMD-BLR|2024-02-13',
    })
    @IsNotEmpty()
    rateKey!: string;

    @ApiProperty({
        description: 'searchReqID received in search result.',
        example: '93e44d92-8236-48c3-acd8-04d43f477a02',
    })
    @IsNotEmpty()
    searchReqID!: string;

    @ApiProperty({
        description: 'providerCode for which this quote needs to be checked.',
        example: 'TBOH',
    })
    @IsNotEmpty()
    providerCode!: string;
}
