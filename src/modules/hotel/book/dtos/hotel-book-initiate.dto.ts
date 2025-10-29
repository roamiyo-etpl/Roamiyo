import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEmail, IsNumber, IsOptional, IsArray, ValidateNested, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { GenderEnum, TitleEnum } from 'src/shared/enums/accounts.enum';

export class PassengerDto {
     @ApiProperty({
        description: 'Passenger type (adult, child, infant)',
        example: 'adult',
    })
    @IsNotEmpty()
    @IsString()
    type: 'adult' | 'child' | 'infant';

    @ApiProperty({
        description: 'Passenger title (Mr, Miss, Mrs, Ms)',
        example: 'Mr',
    })
    @IsNotEmpty()
    @IsString()
    title: string;

    @ApiProperty({
        description: 'Passenger roomId (1,2,3)',
        example: 1,
    })
    @IsNotEmpty()
    @IsNumber()
    roomId: number;

    @ApiProperty({
        description: 'Passenger age (required for child/infant)',
        example: 25,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(120)
    age?: number;

    @ApiProperty({
        description: 'First name',
        example: 'John',
    })
    @IsNotEmpty()
    @IsString()
    firstName: string;

    @ApiProperty({
        description: 'Last name',
        example: 'Doe',
    })
    @IsNotEmpty()
    @IsString()
    lastName: string;

    @ApiProperty({
        description: 'Email address',
        example: 'john.doe@example.com',
        required: false,
    })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({
        description: 'dial Code',
        example: '+91',
        required: false,
    })
    @IsOptional()
    @IsString()
    dialCode?: string;

    @ApiProperty({
        description: 'Phone number',
        example: '+1234567890',
        required: false,
    })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiProperty({
        description: 'Nationality code',
        example: 'US',
        required: false,
    })
    @IsOptional()
    @IsString()
    nationality?: string;
}

export class PaymentDetailsDto {
    @ApiProperty({
        description: 'Payment gateway name',
        example: 'stripe',
    })
    @IsNotEmpty()
    @IsString()
    gatewayName: string;

    @ApiProperty({
        description: 'Payment type',
        example: 'credit_card',
    })
    @IsNotEmpty()
    @IsString()
    paymentType: string;

    @ApiProperty({
        description: 'Amount',
        example: 360.00,
    })
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    totalAmount: number;

    @ApiProperty({
        description: 'Cash amount',
        example: 360.00,
    })
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    cashAmount: number;

    @ApiProperty({
        description: 'Price hash key',
        example: 'price_hash_key',
    })
    @IsNotEmpty()
    @IsString()
    priceHashKey: string;

    @ApiProperty({
        description: 'Payment token',
        example: 'tok_1234567890abcdef',
    })
    @IsNotEmpty()
    @IsString()
    paymentToken: string;

    @ApiProperty({
        description: 'Payment log ID',
        example: 'log_1234567890abcdef',
    })
    @IsNotEmpty()
    @IsString()
    paymentLogId: string;
}

export class ContactDetailsDto {
    @ApiProperty({
        description: 'User title Mr, Miss, and Mrs',
        example: 'Mr',
    })
    @IsNotEmpty()
    @IsEnum(TitleEnum)
    title: TitleEnum;

    @ApiProperty({
        description: 'First name',
        example: 'John',
    })
    @IsNotEmpty()
    @IsString()
    firstName: string;

    @ApiProperty({
        description: 'Last name',
        example: 'Doe',
    })
    @IsNotEmpty()
    @IsString()
    lastName: string;

    @ApiProperty({
        description: 'Contact person/user gender male, female and other',
        example: 'male',
    })
    @IsNotEmpty()
    @IsEnum(GenderEnum)
    gender: GenderEnum;
    

    @ApiProperty({
        description: 'Email address',
        example: 'john.doe@example.com',
    })
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'Dialer Code as country wise',
        example: '+91',
    })
    @IsNotEmpty()
    @IsString()
    dialCode: string;

    @ApiProperty({
        description: 'Phone number',
        example: '+1234567890',
    })
    @IsNotEmpty()
    @IsString()
    phone: string;

    @ApiProperty({
        description: 'Address line 1',
        example: '123 Main Street',
    })
    @IsNotEmpty()
    @IsString()
    addressLine1: string;

    @ApiProperty({
        description: 'Address line 2',
        example: 'Apt 4B',
        required: false,
    })
    @IsOptional()
    @IsString()
    addressLine2: string;

    @ApiProperty({
        description: 'City',
        example: 'New York',
    })
    @IsNotEmpty()
    @IsString()
    city: string;

    @ApiProperty({
        description: 'State',
        example: 'NY',
    })
    @IsNotEmpty()
    @IsString()
    state: string;

    @ApiProperty({
        description: 'Country',
        example: 'United States',
    })
    @IsNotEmpty()
    @IsString()
    country: string;

    @ApiProperty({
        description: 'Postal code',
        example: '10001',
    })
    @IsNotEmpty()
    @IsString()
    postalCode: string;
}

export class HotelBookInitiateDto {
    @ApiProperty({
        description: 'Hotel ID',
        example: '107953',
    })
    @IsNotEmpty()
    @IsString()
    hotelId: string;

    @ApiProperty({
        description: 'Supplier code',
        example: 'TBO',
    })
    @IsNotEmpty()
    @IsString()
    supplierCode: string;

    @ApiProperty({
        description: 'Search request ID from previous search',
        example: 'search_req_12345',
    })
    @IsNotEmpty()
    @IsString()
    searchReqId: string;

    @ApiProperty({
        description: 'Unique booking identifier',
        example: 'booking_12345',
    })
    @IsNotEmpty()
    @IsString()
    rateKey: string;

    @ApiProperty({
        description: 'Passenger details',
        type: [PassengerDto],
        example: [
            {
                type: 'adult',
                roomId: 1,
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@example.com',
                phone: '+1234567890',
                nationality: 'US',
            }
        ],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PassengerDto)
    passengers: PassengerDto[];

    @ApiProperty({
        description: 'Payment details',
        type: PaymentDetailsDto,
    })
    @ValidateNested()
    @Type(() => PaymentDetailsDto)
    paymentDetails: PaymentDetailsDto;

    @ApiProperty({
        description: 'Contact details',
        type: ContactDetailsDto,
    })
    @ValidateNested()
    @Type(() => ContactDetailsDto)
    contactDetails: ContactDetailsDto;
}