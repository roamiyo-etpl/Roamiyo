import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { HotelRoomResponse } from '../../room/interfaces/room-list-response.interface';
import { HotelRoomQuoteResponse } from '../../room/interfaces/room-quote-response.interface';
import { TboRepository } from './tbo.repository';
import { Http } from 'src/shared/utilities/flight/http.utility';
import { v4 as uuid } from 'uuid';
import { TboHotelImagesEntity } from 'src/modules/dump/hotel/entities/tbo-hotel-images.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TboHotelAdditionalDetailsEntity } from 'src/modules/dump/hotel/entities/tbo-hotel-additional-details.entity';

/**
 * TBO Hotel Room Service
 * Handles hotel room operations using TBO API
 * @author Prashant - TBO Room Integration
 */
@Injectable()
export class TboRoomService {
    constructor(
        @InjectRepository(TboHotelImagesEntity)
        private readonly hotelImagesRepository: Repository<TboHotelImagesEntity>,
        @InjectRepository(TboHotelAdditionalDetailsEntity)
        private readonly hotelDetailsRepository: Repository<TboHotelAdditionalDetailsEntity>,
        private readonly tboRepository: TboRepository
    ) {}

    /**
     * Search hotel rooms using TBO API
     * @param roomRequest - Room search request parameters
     * @param providerCredentials - TBO provider credentials
     * @returns Promise<HotelRoomResponse> - Room search results
     */
    async searchRooms(roomRequest: any, providerCredentials: any): Promise<HotelRoomResponse> {
        const searchReqID = roomRequest.searchReqID || uuid();
        // console.log('TBO Room Search Request:', roomRequest);

        try {
            const { hotelId, supplierCode, checkIn, checkOut, rooms } = roomRequest;

            // Validate hotel ID
            if (!hotelId) {
                throw new BadRequestException('Hotel ID is required');
            }

            // Get hotel data from database
            const hotelData = await this.tboRepository.findHotelDetailsByHotelCode(hotelId);
            if (!hotelData) {
                throw new BadRequestException('Hotel not found');
            }

            // Prepare TBO API credentials
            const auth = {
                username: providerCredentials.username,
                password: providerCredentials.password,
            };
            const endpoint = `${providerCredentials.hotel_url}/Search`;
            // console.log(endpoint)

            // Create room search request
            const tboRequest = this.createTboRoomSearchRequest({
                hotelId,
                checkIn,
                checkOut,
                rooms,
            });

            // console.log('TBO Room API Request:', tboRequest);

            // Execute room search
            const response = await this.executeRoomSearchWithRetry(tboRequest, endpoint, auth);

            console.log(response,"data");
            // Convert TBO response to our standard format
            const roomResponse = this.convertTboRoomResponseToStandard(response, hotelData, searchReqID,rooms);

            return roomResponse;
        } catch (error) {
            console.error('TBO Room Search Service Error:', error);
            throw new InternalServerErrorException('ERR_TBO_ROOM_SEARCH_FAILED');
        }
    }

    /**
     * Get room quote using TBO API
     * @param quoteRequest - Room quote request parameters
     * @param providerCredentials - TBO provider credentials
     * @returns Promise<HotelRoomQuoteResponse> - Room quote result
     */
    async searchRoomQuote(quoteRequest: any, providerCredentials: any): Promise<HotelRoomQuoteResponse> {
        console.log('TBO Room Quote Request:', quoteRequest);

        try {
            const { rateKey, searchReqID } = quoteRequest;

            // Validate rate key
            if (!rateKey) {
                throw new BadRequestException('Rate key is required');
            }

            // Prepare TBO API credentials
            const auth = {
                username: providerCredentials.username,
                password: providerCredentials.password,
            };
            const endpoint = `${providerCredentials.hotel_url}/PreBook`;

            // Create quote request
            const tboRequest = {
                BookingCode: rateKey,
            };

            console.log('TBO Room Quote API Request:', tboRequest, auth);

            // Execute quote request
            const response = await this.executeQuoteWithRetry(tboRequest, endpoint, auth);

            // console.log(response);
            // Convert TBO response to our standard format
            const quoteResponse = this.convertTboQuoteResponseToStandard(response, rateKey);

            return quoteResponse;
        } catch (error) {
            console.error('TBO Room Quote Service Error:', error);
            throw new InternalServerErrorException('ERR_TBO_ROOM_QUOTE_FAILED');
        }
    }

    /**
     * Create TBO API room search request
     * @param params - Search parameters
     * @returns TBO room search request object
     */
    private createTboRoomSearchRequest(params: any): any {
        const { hotelId, checkIn, checkOut, rooms } = params;

        return {
            CheckIn: checkIn,
            CheckOut: checkOut,
            Filters: {
                Refundable: false,
                NoOfRooms: 0,
                MealType: 0,
                OrderBy: 0,
                StarRating: 0,
                HotelName: null,
            },
            GuestNationality: 'IN', // Default to India
            HotelCodes: hotelId,
            IsDetailedResponse: true,
            PaxRooms: rooms.map((room) => ({
                Adults: room.adults,
                Children: room.children,
                ChildrenAges: room.childAges || null,
            })),
            ResponseTime: 23.0,
        };
    }

    /**
     * Execute room search with retry logic
     * @param request - Search request
     * @param endpoint - API endpoint
     * @param auth - Authentication credentials
     * @param maxRetries - Maximum retry attempts
     * @returns Promise<any> - API response
     */
    private async executeRoomSearchWithRetry(request: any, endpoint: string, auth: any, maxRetries: number = 2): Promise<any> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await Http.httpRequestTBOHotel('POST', endpoint, request, auth);
                console.log(`TBO Room Search (attempt ${attempt}): ${response?.HotelResult?.length || 0} hotels`);
                return response;
            } catch (error) {
                console.error(`TBO Room Search attempt ${attempt} failed:`, error.message);
                if (attempt === maxRetries) {
                    throw error;
                }
                // Wait before retry (exponential backoff)
                await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    /**
     * Execute quote request with retry logic
     * @param request - Quote request
     * @param endpoint - API endpoint
     * @param auth - Authentication credentials
     * @param maxRetries - Maximum retry attempts
     * @returns Promise<any> - API response
     */
    private async executeQuoteWithRetry(request: any, endpoint: string, auth: any, maxRetries: number = 2): Promise<any> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await Http.httpRequestTBOHotel('POST', endpoint, request, auth);
                console.log(`TBO Room Quote (attempt ${attempt}): Success`);
                return response;
            } catch (error) {
                console.error(`TBO Room Quote attempt ${attempt} failed:`, error.message);
                if (attempt === maxRetries) {
                    throw error;
                }
                // Wait before retry (exponential backoff)
                await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    /**
     * Convert TBO API response to our standard HotelRoomResponse format
     * @param response - TBO API response
     * @param hotelData - Hotel data from database
     * @param searchReqID - Search request ID
     * @returns HotelRoomResponse - Standardized room response
     */
    private async convertTboRoomResponseToStandard(response: any, hotelData: any, searchReqID: string, searchReqRoom:any): Promise<HotelRoomResponse> {
        if (!response?.HotelResult?.length) {
            return {
                searchReqID,
                message: 'No rooms available',
                roomData: {
                    hotelName: hotelData.hotelName || 'Unknown Hotel',
                    latitude: hotelData.latitude?.toString() || '0',
                    longitude: hotelData.longitude?.toString() || '0',
                    address: hotelData.address || '',
                    city: hotelData.city || '',
                    country: hotelData.country || '',
                    countryCode: hotelData.countryCode || '',
                    roomCount: 0,
                    roomList: [],
                },
                success: false,
            };
        }

        console.log(response);


        const hotelCode = hotelData.hotelCode;

          // Fetch additional hotel data in parallel
        const [hotelDetailsMap, imagesMap] = await Promise.all([
        // const [ imagesMap] = await Promise.all([
            this.fetchHotelAdditionalDetails(hotelCode),
            this.fetchHotelImages(hotelCode),
        ]);

        const additionalDetails = hotelDetailsMap.size > 0 ? Array.from(hotelDetailsMap.values())[0] : null;

        let images = imagesMap.size > 0 ? Array.from(imagesMap.values())[0] : [];
        const hotelImages: string[] = images.map(img => img.url);

        const hotelResult = response.HotelResult[0];
        const rooms = Array.isArray(hotelResult.Rooms) ? hotelResult.Rooms : [];

        const roomList = rooms.map((room, index) => {
            const roomName = Array.isArray(room.Name) ? room.Name.join(', ') : room.Name || `Room ${index + 1}`;
            // const roomName = Array.isArray(room.Name) ? `${room.Name[0]} * ${room.Name.length}` : `Room ${index + 1}`;
            console.log(room,'room');

            return {
                options: [
                    {
                        roomName,
                        price: {
                            selling: Number(room.TotalFare) || 0,
                            currency: hotelResult.Currency || 'USD',
                            taxIncluded: true,
                            taxes: Number(room.TotalTax) || 0,
                            priceHash: `${hotelData.hotelCode}_${room.TotalFare}_${searchReqID}`,
                        },
                        // hotelId: hotelData.hotelCode,
                        hotelId: hotelResult,
                        roomBookingInfo: [
                            {
                                rateKey: room.BookingCode || '',
                                maxGuestAllowed: {},
                            },
                        ],
                        // rooms: 2,
                        rooms: room.Name.length,
                        adults: 2, // Default
                        children: 0,
                        childrenAges: '',
                        rateType: 'STANDARD',
                        roomCode: room.BookingCode || '',
                        supplierId: 'TBO',
                        supplierCode: 'TBO',
                        boardCode: room.MealType || '',
                        cancellationPolicy: {
                            refundable: room.IsRefundable || false,
                            currency: hotelResult.Currency || 'USD',
                            penalties: room.CancelPolicies || [],
                        },
                        paymentType: 'PREPAID',
                        boardInfo: room.Inclusion || '',
                        roomDetails: {
                            roomCategory: roomName,
                            roomView: '',
                            beds: {
                                suggestedBedType: '',
                                suggestedBedTypeWithoutNumber: '',
                                bedsArr: [],
                            },
                            bathroomType: '',
                            roomArea: {},
                            roomDescription: room.Inclusion || '',
                            propertyType: '',
                            roomFacilities: additionalDetails?.amenities || [],
                            roomImages: hotelImages || [],
                        },
                    },
                ],
                roomName,
                price: {
                    selling: Number(room.TotalFare) || 0,
                    currency: hotelResult.Currency || 'USD',
                    taxIncluded: true,
                    taxes: Number(room.TotalTax) || 0,
                    priceHash: `${hotelData.hotelCode}_${room.TotalFare}_${searchReqID}`,
                },
                hotelId: hotelData.hotelCode,
                rateType: 'STANDARD',
                roomBookingInfo: [
                    {
                        rateKey: room.BookingCode || '',
                        maxGuestAllowed: {},
                    },
                ],
                // rooms: 1,
                rooms: room.Name.length,
                adults: 2, // Default
                children: 0,
                roomCode: room.BookingCode || '',
                supplierId: 'TBO',
                supplierCode: 'TBO',
                supplierRoomName: roomName,
                boardCode: room.MealType || '',
                cancellationPolicy: {
                    refundable: room.IsRefundable || false,
                    currency: hotelResult.Currency || 'USD',
                    penalties: room.CancelPolicies,
                },
                paymentType: 'PREPAID',
                boardInfo: room.Inclusion || '',
            };
        });

        return {
            searchReqID,
            message: 'Rooms fetched successfully',
            roomData: {
                hotelName: hotelData.hotelName || 'Unknown Hotel',
                latitude: hotelData.latitude?.toString() || '0',
                longitude: hotelData.longitude?.toString() || '0',
                address: hotelData.address || '',
                city: hotelData.city || '',
                country: hotelData.country || '',
                countryCode: hotelData.countryCode || '',
                roomCount: roomList.length,
                roomList,
            },
            success: true,
        };
    }

    /**
     * Convert TBO quote response to our standard HotelRoomQuoteResponse format
     * @param response - TBO API response
     * @param rateKey - Rate key used for quote
     * @returns HotelRoomQuoteResponse - Standardized quote response
     */
    private convertTboQuoteResponseToStandard(response: any, rateKey: string): HotelRoomQuoteResponse {
        
        const hotel= response.HotelResult[0];
        const rooms= hotel.Rooms[0];
        // console.log(response,"Rooms");
        // const rooms= response.HotelResult.Rooms;
        return {
            uniqueId: rateKey,
            remarks: hotel.RateConditions || 'Quote retrieved successfully',
            price: Number(rooms.NetAmount) || 0,
            status: response.Status.Code!=200 ? 'NOT AVAILABLE' : 'AVAILABLE',
            cancellationPolicy: {
                refundable: rooms.IsRefundable,
                // refundable: response,
                currency: hotel.Currency || 'USD',
                penalties: rooms.CancelPolicies,
            },
        };
    }



     /**
         * Fetches hotel images from database
         * @author Qamar Ali - 27-10-2025
         * @param hotelCodes - Array of hotel codes to fetch images for
         * @returns Map of hotel codes to their images
         */
    private async fetchHotelImages(hotelCode: string): Promise<Map<string, TboHotelImagesEntity[]>> {
            try {
                const hotelImages = await this.hotelImagesRepository
                    .createQueryBuilder('image')
                    .where('image.hotelCode = :hotelCode', { hotelCode })  // single code match
                    .orderBy('image.visualOrder', 'ASC')
                    .addOrderBy('image.order', 'ASC')
                    .getMany();
    
                 const imagesMap = new Map<string, TboHotelImagesEntity[]>();
    
                // Since it's a single hotel code, just set all images here
                imagesMap.set(hotelCode, hotelImages);
    
                return imagesMap;
            } catch (error) {
                console.error('Error fetching hotel images:', error);
                return new Map();
            }
        }

         /**
             * Fetches additional hotel details from database
             * @author Qamar Ali - 27-10-2025
             * @param hotelCodes - Array of hotel codes to fetch details for
             * @returns Map of hotel codes to their additional details
        */
            private async fetchHotelAdditionalDetails(hotelCode: string): Promise<Map<string, TboHotelAdditionalDetailsEntity>> {
                try {
                    const hotel = await this.hotelDetailsRepository.createQueryBuilder('hotel').where('hotel.hotelCode = :hotelCode', { hotelCode }).getOne();
        
                    const hotelDetailsMap = new Map<string, TboHotelAdditionalDetailsEntity>();
                    if (hotel) {
                        hotelDetailsMap.set(hotel.hotelCode, hotel);
                    }
        
                    return hotelDetailsMap;
                } catch (error) {
                    console.error('Error fetching hotel additional details:', error);
                    return new Map();
                }
            }
}
