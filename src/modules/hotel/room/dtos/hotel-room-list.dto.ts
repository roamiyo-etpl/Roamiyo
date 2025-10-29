import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsDateString, IsNumber, IsOptional, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { RoomDto } from '../../search/dtos/hotel-search-initiate.dto';

export class HotelRoomListRequestDto {
    @ApiProperty({
        description: 'Hotel ID',
        example: '107953',
    })
    @IsNotEmpty()
    @IsString()
    hotelId: string;

    @ApiProperty({
        description: 'Supplier code',
        example: 'HOB',
    })
    @IsNotEmpty()
    @IsString()
    supplierCode: string;

    @ApiProperty({
        description: 'Check-in date (YYYY-MM-DD)',
        example: '2024-01-15',
    })
    @IsNotEmpty()
    @IsDateString()
    checkIn: string;

    @ApiProperty({
        description: 'Check-out date (YYYY-MM-DD)',
        example: '2024-01-18',
    })
    @IsNotEmpty()
    @IsDateString()
    checkOut: string;

    @ApiProperty({
        description: 'Room configuration',
        type: [RoomDto],
        example: [
            { adults: 2, children: 1, childAges: [8] },
            { adults: 1, children: 0 }
        ],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RoomDto)
    rooms: RoomDto[];
}
