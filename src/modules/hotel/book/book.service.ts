import { Injectable } from '@nestjs/common';
import { ProviderBookService } from '../providers/provider-book.service';
import { HotelBookInitiateResponse } from './interfaces/book-initiate-response.interface';
import { HotelBookInitiateDto, PassengerDto } from './dtos/hotel-book-initiate.dto';
import { HotelBookConfirmationDto } from './dtos/hotel-book-confirmation.dto';
import { HotelBookConfirmationResponse } from './interfaces/book-confirmation-response.interface';

@Injectable()
export class HotelBookService {
    constructor(private readonly providerBookService: ProviderBookService) { }

    async initiate(bookDto: HotelBookInitiateDto, headers: Headers): Promise<HotelBookInitiateResponse> {

        const { searchReqId, passengers, paymentDetails, contactDetails } = bookDto;

        const currency = String(headers['currency-preference'] ?? 'INR');

        // const transformedPaxes = this.transformPaxesData(passengers);
        console.log(bookDto, "book dto", headers);

        return {
            success: true,
            message: 'Book initiate successful',
            data: {
                bookingRefId: '1234567890'
            }
        }
    }

    async bookConfirmation(bookDto: HotelBookConfirmationDto): Promise<HotelBookConfirmationResponse> {
        return await this.providerBookService.bookConfirmation(bookDto);
    }


    /**
     * Converts passengers as data base
     * @author Qamar Ali - 27-10-2025
     * @param paxes - paxes details
     * @returns paxes details
     */
    // private transformPaxesData(paxes: PassengerDto[]): PaxesInterface {
    //     // Initialize the structure for the PaxesInterface
    //     const initialPaxesData: PaxesInterface = {
    //         adult: { count: 0, data: [] },
    //         child: { count: 0, data: [] },
    //         infant: { count: 0, data: [] },
    //     };

    //     // Loop through each pax to classify them
    //     paxes.forEach((pax) => {
    //         const { type, ...paxData } = pax;
    //         if (type === 'adult') {
    //             initialPaxesData.adult.count++;
    //             initialPaxesData.adult.data.push(paxData);
    //         } else if (type === 'child') {
    //             initialPaxesData.child.count++;
    //             initialPaxesData.child.data = initialPaxesData.child.data || []; // Ensure it's initialized
    //             initialPaxesData.child.data.push(paxData);
    //         } else if (type === 'infant') {
    //             initialPaxesData.infant.count++;
    //             initialPaxesData.infant.data = initialPaxesData.infant.data || []; // Ensure it's initialized
    //             initialPaxesData.infant.data.push(paxData);
    //         } else {
    //             throw new BadRequestException(`Invalid pax type`);
    //         }
    //     });

    //     return initialPaxesData;

    //     // return paxes.reduce((acc, pax) => {
    //     //     // Ensure only valid types are processed
    //     //     if (!['adult', 'child', 'infant'].includes(pax.type)) {
    //     //         throw new BadRequestException(`Invalid pax type: ${pax.type}`);
    //     //     }
    //     //     // Increment the count and push the pax into the correct category
    //     //     // Ensure that data array is always initialized for each type
    //     //     if (!acc[pax.type]) {
    //     //         acc[pax.type] = { count: 0, data: [] };
    //     //     }
    //     //     acc[pax.type].count++;
    //     //     acc[pax.type].data.push(pax);

    //     //     return acc;
    //     // }, initialPaxesData);
    // }
}