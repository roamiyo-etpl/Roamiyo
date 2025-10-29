import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Http } from 'src/shared/utilities/flight/http.utility';
import { AmenityMasterEntity } from './entities/amenity-master.entity';
import { AmenityMappingEntity } from './entities/amenity-mapping.entity';
import { BoardCodeMasterEntity } from './entities/board-code-master.entity';
import { BoardCodeMappingEntity } from './entities/board-code-mapping.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { HotelAutocompleteDto } from './dtos/hotel-autocomplete.dto';
import { HotelAutocompleteInterface, HotelAutocompleteResponse } from './interfaces/hotel-response.interface';
import { CommonResponse } from 'src/shared/interfaces/common-response.interface';
import { HotelAmenity, HotelDetailResponse, HotelImageSizes } from './interfaces/hotel-detail.interface';
import { TransferDataToHotelContent } from './dtos/transfer-data-to-hotel-content.dto';
import { SupplierCredService } from 'src/modules/generic/supplier-credientials/supplier-cred.service';
import { CountryEntity } from 'src/shared/entities/country.entity';
import { CityEntity } from 'src/shared/entities/city.entity';
import { HotelMasterEntity, HotelSourceEnum, StarRatingEnum } from 'src/shared/entities/hotel-master.entity';
import { TboHotelImagesEntity } from './entities/tbo-hotel-images.entity';
import { TboHotelAdditionalDetailsEntity } from './entities/tbo-hotel-additional-details.entity';
import { TboHotelContentEntity } from './entities/tbo-hotel-content.entity';
import { TboHotelRoomContentEntity } from './entities/tbo-hotel-room-content.entity';

/**
 * Hotel dump service - handles hotel data dump operations
 * @author Prashant - TBO Integration
 */
@Injectable()
export class HotelDumpService {
    private readonly logger = new Logger(HotelDumpService.name);
    private terminalsCache: Map<string, any> = new Map();

    constructor(
        @InjectRepository(AmenityMasterEntity)
        private readonly amenityMasterRepository: Repository<AmenityMasterEntity>,
        @InjectRepository(AmenityMappingEntity)
        private readonly amenityMappingRepository: Repository<AmenityMappingEntity>,
        @InjectRepository(BoardCodeMasterEntity)
        private readonly boardCodeMasterRepository: Repository<BoardCodeMasterEntity>,
        @InjectRepository(BoardCodeMappingEntity)
        private readonly boardCodeMappingRepository: Repository<BoardCodeMappingEntity>,
        @InjectRepository(TboHotelAdditionalDetailsEntity)
        private readonly hotelDetailsRepository: Repository<TboHotelAdditionalDetailsEntity>,
        @InjectRepository(TboHotelImagesEntity)
        private readonly hotelImagesRepository: Repository<TboHotelImagesEntity>,
        @InjectRepository(TboHotelContentEntity)
        private readonly hotelContentRepository: Repository<TboHotelContentEntity>,
        @InjectRepository(TboHotelRoomContentEntity)
        private readonly hotelRoomContentRepository: Repository<TboHotelRoomContentEntity>,
        @InjectRepository(CountryEntity)
        private readonly countryRepository: Repository<CountryEntity>,
        @InjectRepository(CityEntity)
        private readonly cityRepository: Repository<CityEntity>,
        @InjectRepository(HotelMasterEntity)
        private readonly hotelMasterRepository: Repository<HotelMasterEntity>,
        private readonly supplierCredService: SupplierCredService,
    ) {}

    /**
     * Get hotel autocomplete suggestions
     * @param hotelAutocompleteDto - Search criteria
     * @returns Promise<HotelAutocompleteResponse> - Autocomplete suggestions
     */
    async getHotelAutocomplete(hotelAutocompleteDto: HotelAutocompleteDto): Promise<HotelAutocompleteResponse> {
        try {
            const { query: search, lat, long } = hotelAutocompleteDto;

            if (!search || search.trim().length < 2) {
                throw new BadRequestException('Search term must be at least 2 characters long');
            }

            const searchTerm = search.trim().toLowerCase();

            // Search hotels by name, city, or country
            const hotels = await this.hotelContentRepository
                .createQueryBuilder('hotel')
                .where('(LOWER(hotel.hotelName) LIKE :search OR LOWER(hotel.city) LIKE :search OR LOWER(hotel.country) LIKE :search)', { search: `%${searchTerm}%` })
                .orderBy('hotel.hotelName', 'ASC')
                .limit(10)
                .getMany();

            const suggestions: HotelAutocompleteInterface[] = hotels.map((hotel) => ({
                hotelCode: hotel.hotelCode,
                hotelName: hotel.hotelName,
                city: hotel.city,
                state: hotel.state,
                country: hotel.country,
                rating: hotel.rating,
                address: hotel.address,
                heroImage: hotel.heroImage,
            }));

            return {
                success: true,
                message: 'Hotel autocomplete suggestions retrieved successfully',
                data: suggestions,
                totalCount: suggestions.length,
            };
        } catch (error) {
            this.logger.error('Error in getHotelAutocomplete:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to get hotel autocomplete suggestions');
        }
    }

    /**
     * Get hotel details by hotel code
     * @param hotelCode - Hotel code
     * @returns Promise<HotelDetailResponse> - Hotel details
     */
    async getHotelDetails(hotelCode: string): Promise<HotelDetailResponse> {
        try {
            if (!hotelCode) {
                throw new BadRequestException('Hotel code is required');
            }

            // Get basic hotel information
           

             const hotel = await this.hotelMasterRepository.findOne({
                where: { hotelCode },
            });

            const hotelContent = await this.hotelContentRepository.findOne({
                where: { hotelCode },
            });

            if (!hotel || ! hotelContent) {
                throw new BadRequestException('Hotel not found');
            }

            

            // Get additional hotel details
            const additionalDetails = await this.hotelDetailsRepository.findOne({
                where: { hotelCode },
            });
           

            // Get hotel images (simplified for now)
            const images = await this.hotelImagesRepository.find({
                where: { hotelCode },
            });

            
            // ✅ Properly map DB image records into HotelImageSizes objects
                const hotelImages: HotelImageSizes[] = images.length > 0
                    ? images.map(img => ({
                        imageType: img.typeName || '',    // map DB column to interface property
                        imagePath: img.url || '',         // map DB column to interface property
                        imageOrder: img.order || 0,       // numeric order
                        imageSize: img.visualOrder ? String(img.visualOrder) : '', // convert to string if needed
                    }))
                    : [];
            // Get hotel amenities (simplified - return empty for now)
            const amenities: HotelAmenity[] = [];

            // Get board codes (simplified - return empty for now)
            const boardCodes = [];

            // Process images (simplified for now)
            const processedImages: HotelImageSizes[] = [];

            return {
                success: true,
                message: 'Hotel details retrieved successfully',
                data: {
                    hotelCode: hotel.hotelCode,
                    hotelName: hotel.hotelName,
                    rating: hotelContent.rating,
                    latitude: hotelContent.latitude,
                    longitude: hotelContent.longitude,
                    address: hotelContent.address,
                    city: hotelContent.city,
                    state: hotelContent.state,
                    country: hotelContent.country,
                    cityCode: hotelContent.cityCode,
                    stateCode: hotelContent.stateCode,
                    countryCode: hotelContent.countryCode,
                    pincode: additionalDetails?.pincode || '',
                    heroImage: additionalDetails?.heroImage|| '',
                    description: (hotel?.highlightText as unknown as string) || '',
                    facilities: [],
                    policies: [],
                    amenities: additionalDetails?.amenities || [],
                    boardCodes,
                    images: hotelImages || [],
                },
            };
        } catch (error) {
            this.logger.error('Error in getHotelDetails:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to get hotel details');
        }
    }

    /**
     * Transfer data to hotel content table
     * @param transferData - Data transfer request
     * @returns Promise<CommonResponse> - Transfer result
     */
    async transferDataToHotelContent(transferData: TransferDataToHotelContent): Promise<CommonResponse> {
        try {
            const { from, to } = transferData;

            if (!from || !to) {
                throw new BadRequestException('From and to values are required');
            }

            // This is a placeholder implementation
            // In a real scenario, you would implement the actual data transfer logic
            this.logger.log(`Transferring data from ${from} to ${to}`);

            return {
                success: true,
                message: `Data transfer from ${from} to ${to} completed successfully`,
            };
        } catch (error) {
            this.logger.error('Error in transferDataToHotelContent:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to transfer data');
        }
    }

    /**
     * Get hotel room content by hotel code
     * @param hotelCode - Hotel code
     * @returns Promise<any> - Room content
     */
    async getHotelRoomContent(hotelCode: string): Promise<any> {
        try {
            if (!hotelCode) {
                throw new BadRequestException('Hotel code is required');
            }

            const roomContent = await this.hotelRoomContentRepository.find({
                where: { hotelCode },
            });

            return {
                success: true,
                message: 'Hotel room content retrieved successfully',
                data: roomContent,
            };
        } catch (error) {
            this.logger.error('Error in getHotelRoomContent:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to get hotel room content');
        }
    }

    /**
     * Bulk insert hotel content
     * @param hotelData - Array of hotel data
     * @returns Promise<CommonResponse> - Insert result
     */
    async bulkInsertHotelContent(hotelData: any[]): Promise<CommonResponse> {
        try {
            if (!hotelData || hotelData.length === 0) {
                throw new BadRequestException('Hotel data is required');
            }

            // Process and insert hotel data
            const processedData = hotelData.map((hotel) => ({
                hotelCode: hotel.hotelCode,
                hotelName: hotel.hotelName,
                rating: hotel.rating,
                latitude: hotel.latitude,
                longitude: hotel.longitude,
                address: hotel.address,
                city: hotel.city,
                state: hotel.state,
                country: hotel.country,
                cityCode: hotel.cityCode,
                stateCode: hotel.stateCode,
                countryCode: hotel.countryCode,
                pincode: hotel.pincode,
                heroImage: hotel.heroImage,
                hotelNameNormalized: hotel.hotelName?.toLowerCase().replace(/[^a-z0-9]/g, ''),
            }));

            await this.hotelContentRepository.save(processedData);

            return {
                success: true,
                message: `${processedData.length} hotel records inserted successfully`,
            };
        } catch (error) {
            this.logger.error('Error in bulkInsertHotelContent:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to insert hotel content');
        }
    }

    /**
     * Add country list dump from TBO API
     * @param headers - Request headers
     * @returns Promise<CommonResponse> - Dump result
     */
    async addCountryList(headers: Headers): Promise<CommonResponse> {
        try {
            this.logger.log('Starting country list dump from TBO API');

            // Get provider credentials
            const providersData = await this.supplierCredService.getActiveProviders(headers);
            const tboProvider = providersData.find((p) => p.code === 'TBO');

            if (!tboProvider) {
                throw new BadRequestException('TBO provider not found');
            }
            console.log(tboProvider.provider_credentials, 'provider_credentials');

            const providerCredentials = JSON.parse(tboProvider.provider_credentials);
            const auth = {
                username: providerCredentials.dump_username,
                password: providerCredentials.dump_password,
            };

            console.log(auth);
            const endpoint = `${providerCredentials.dump_url}/CountryList`;

            // Fetch country list from TBO API
            const response = await Http.httpRequestTBOHotel('GET', endpoint, null, auth);
            console.log(response);

            if (!response.CountryList || !Array.isArray(response.CountryList)) {
                throw new BadRequestException('Invalid country list response from TBO API');
            }

            // Check if countries already exist
            const existingCountries = await this.countryRepository
                .createQueryBuilder('country')
                .where('country.iso2 IN (:...codes)', {
                    codes: response.CountryList.map((country) => country.Code),
                })
                .getMany();

            if (existingCountries.length > 0) {
                return {
                    success: true,
                    message: 'Country list already exists in database',
                };
            }

            // Prepare country entities
            const countryEntities = response.CountryList.map((country) => {
                const entity = new CountryEntity();
                entity.iso2 = country.Code;
                entity.countryName = country.Name;
                return entity;
            });

            // Save countries to database
            await this.countryRepository.save(countryEntities);

            this.logger.log(`Successfully added ${countryEntities.length} countries`);
            return {
                success: true,
                message: `Country list added successfully: ${countryEntities.length} countries`,
            };
        } catch (error) {
            this.logger.error('Error in addCountryList:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to add country list');
        }
    }

    /**
     * Add city list dump from TBO API
     * @param headers - Request headers
     * @returns Promise<CommonResponse> - Dump result
     */
    async addCityList(headers: Headers): Promise<CommonResponse> {
        try {
            this.logger.log('Starting city list dump from TBO API');

            // Get provider credentials
            const providersData = await this.supplierCredService.getActiveProviders(headers);
            const tboProvider = providersData.find((p) => p.code === 'TBO');

            if (!tboProvider) {
                throw new BadRequestException('TBO provider not found');
            }

            const providerCredentials = JSON.parse(tboProvider.provider_credentials);
            const auth = {
                username: providerCredentials.dump_username,
                password: providerCredentials.dump_password,
            };
            const endpoint = `${providerCredentials.dump_url}/CityList`;

            // Check if cities already exist
            const citiesCount = await this.cityRepository.count();
            if (citiesCount > 0) {
                return {
                    success: true,
                    message: 'City list already exists in database',
                };
            }

            // Get all countries
            const countries = await this.countryRepository.find();
            let allCities: CityEntity[] = [];

            // Fetch cities for each country
            for (const country of countries) {
                try {
                    const response = await Http.httpRequestTBOHotel('POST', endpoint, { CountryCode: country.iso2 }, auth);

                    if (!response.CityList || !Array.isArray(response.CityList)) {
                        this.logger.warn(`No cities found for country ${country.iso2}`);
                        continue;
                    }

                    const cities = response.CityList.map((city) => {
                        const entity = new CityEntity();
                        entity.cityName = city.Name;
                        entity.cityCodeTbo = city.Code;
                        entity.countryId = country.countryId;
                        entity.countryCode = country.iso2 || '';
                        entity.countryName = country.countryName;
                        entity.stateId = 0; // Default state ID
                        entity.stateCode = ''; // Default state code
                        entity.stateName = ''; // Default state name
                        entity.latitude = 0; // Default latitude
                        entity.longitude = 0; // Default longitude
                        return entity;
                    });

                    allCities = allCities.concat(cities);
                } catch (error) {
                    this.logger.error(`Failed to fetch cities for country ${country.iso2}:`, error);
                    continue;
                }
            }

            if (allCities.length === 0) {
                throw new BadRequestException('No cities found in any API response');
            }

            // Save cities to database
            await this.cityRepository.save(allCities, { chunk: 100 });

            this.logger.log(`Successfully added ${allCities.length} cities`);
            return {
                success: true,
                message: `City list added successfully: ${allCities.length} cities`,
            };
        } catch (error) {
            this.logger.error('Error in addCityList:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to add city list');
        }
    }

    /**
     * Add hotel list dump from TBO API
     * @param headers - Request headers
     * @returns Promise<CommonResponse> - Dump result
     */
    // async addHotelList(headers: Headers): Promise<CommonResponse> {
    //     try {
    //         this.logger.log('Starting hotel list dump from TBO API');

    //         // Get provider credentials
    //         const providersData = await this.supplierCredService.getActiveProviders(headers);
    //         const tboProvider = providersData.find((p) => p.code === 'TBO');

    //         if (!tboProvider) {
    //             throw new BadRequestException('TBO provider not found');
    //         }

    //         const providerCredentials = JSON.parse(tboProvider.provider_credentials);
    //         const auth = {
    //                 username: providerCredentials.dump_username,
    //                 password: providerCredentials.dump_password,
    //         };
    //         const endpoint = `${providerCredentials.dump_url}/HotelCodeList`;

    //         // Fetch hotel codes from TBO API
    //         const response = await Http.httpRequestTBOHotel('GET', endpoint, null, auth);

    //         // console.log(response,"response");

    //         if (!response.HotelCodes || !Array.isArray(response.HotelCodes)) {
    //             throw new BadRequestException('Invalid hotel codes response from TBO API');
    //         }

    //         const hotelCodes = response.HotelCodes;

    //         // Check existing hotels in chunks to avoid parameter limits
    //         const chunkSize = 1000;
    //         let existingHotels: HotelMasterEntity[] = [];

    //         for (let i = 0; i < hotelCodes.length; i += chunkSize) {
    //             const chunk = hotelCodes.slice(i, i + chunkSize);
    //             const hotels = await this.hotelMasterRepository.createQueryBuilder('hotel').where('hotel.hotelCode IN (:...codes)', { codes: chunk }).select('hotel.hotelCode').getMany();
    //             existingHotels = existingHotels.concat(hotels);
    //         }

    //         const existingCodes = new Set(existingHotels.map((h) => h.hotelCode));
    //         const newHotelCodes = hotelCodes.filter((code: string) => !existingCodes.has(code));

    //         if (newHotelCodes.length === 0) {
    //             return {
    //                 success: true,
    //                 message: 'All hotel codes already exist in database',
    //             };
    //         }

    //         // Prepare hotel entities
    //         const hotelEntities = newHotelCodes.map((code: string) => {
    //             const entity = new HotelMasterEntity();
    //             entity.hotelCode = code;
    //             entity.hotelName = '';
    //             entity.providerCode = 'TBO';
    //             entity.isActive = true;
    //             entity.isDeleted = false;
    //             return entity;
    //         });

    //         // Save hotels to database
    //         await this.hotelMasterRepository.save(hotelEntities, { chunk: 100 });

    //         this.logger.log(`Successfully added ${hotelEntities.length} hotel codes`);
    //         return {
    //             success: true,
    //             message: `Hotel codes added successfully: ${hotelEntities.length} hotels`,
    //         };
    //     } catch (error) {
    //         this.logger.error('Error in addHotelList:', error);
    //         if (error instanceof BadRequestException) {
    //             throw error;
    //         }
    //         throw new InternalServerErrorException('Failed to add hotel list');
    //     }
    // }

    async addHotelList(headers: Headers): Promise<CommonResponse> {
        try {
            this.logger.log('Starting hotel list dump from TBO API');

            // Get provider credentials
            const providersData = await this.supplierCredService.getActiveProviders(headers);
            const tboProvider = providersData.find((p) => p.code === 'TBO');
            if (!tboProvider) throw new BadRequestException('TBO provider not found');

            const providerCredentials = JSON.parse(tboProvider.provider_credentials);
            const auth = {
                username: providerCredentials.dump_username,
                password: providerCredentials.dump_password,
            };

            // const cityCode = '130443'; // Delhi
            const cityCode = '115936'; // Dubai


            // Step 1: Get hotel codes by city
            const listEndpoint = `${providerCredentials.dump_url}/TBOHotelCodeList`;
            const hotelListResponse = await Http.httpRequestTBOHotel('POST', listEndpoint, { CityCode: cityCode }, auth);
            if (!hotelListResponse.Hotels || !Array.isArray(hotelListResponse.Hotels)) {
                throw new BadRequestException('Invalid hotel codes response from TBO API');
            }

            const Hotels = hotelListResponse.Hotels;

            // Step 2: Check which hotels already exist to avoid duplicates
            const chunkSize = 1000;
            let existingHotels: HotelMasterEntity[] = [];

            for (let i = 0; i < Hotels.length; i += chunkSize) {
                const chunk = Hotels.slice(i, i + chunkSize).map((h) => h.HotelCode);
                const hotels = await this.hotelMasterRepository.createQueryBuilder('hotel').where('hotel.hotelCode IN (:...codes)', { codes: chunk }).select('hotel.hotelCode').getMany();

                existingHotels = existingHotels.concat(hotels);
            }

            const existingCodes = new Set(existingHotels.map((h) => h.hotelCode));
            const newHotels = Hotels.filter((h) => !existingCodes.has(h.HotelCode));

            if (newHotels.length === 0) {
                return { success: true, message: 'All hotel codes already exist in database' };
            }

            // Step 3: For each new hotel, fetch detailed info in parallel
            const detailEndpoint = `${providerCredentials.dump_url}/Hoteldetails`;

            const detailedResponses = await Promise.all(newHotels.map((hotel) => Http.httpRequestTBOHotel('POST', detailEndpoint, { Hotelcodes: hotel.HotelCode }, auth)));

            // Step 4: Prepare entities from detailed info
            const hotelEntities: HotelMasterEntity[] = [];
            const hotelContentEntities: TboHotelContentEntity[] =[];
            const hotelAdditionalDetailsEntities: TboHotelAdditionalDetailsEntity[] = [];
            const hotelImagesEntities: TboHotelImagesEntity[] = [];

            for (const detailResp of detailedResponses) {
                if (detailResp.HotelDetails && detailResp.HotelDetails.length > 0) {
                    const detail = detailResp.HotelDetails[0];

                    const entity = new HotelMasterEntity();
                    entity.hotelCode = detail.HotelCode;
                    entity.hotelName = detail.HotelName || '';
                    entity.highlightText = detail.Description || '';
                    entity.address = detail.Address || '';
                    entity.city = detail.CityName || '';
                    entity.countryCode = detail.CountryCode || '';
                    entity.latitude = detail.Map ? detail.Map.split('|')[0] : null;
                    entity.longitude = detail.Map ? detail.Map.split('|')[1] : null;
                    entity.starRating = detail.HotelRating || null;
                    entity.providerCode = 'TBO';
                    entity.hotelSource = HotelSourceEnum.TBO;
                    entity.isActive = true;
                    entity.isDeleted = false;
                    entity.createdAt = new Date();
                    // add more fields as needed

                    hotelEntities.push(entity);


                    const hotelContent = new TboHotelContentEntity();
                    hotelContent.hotelCode = detail.HotelCode;
                    hotelContent.hotelName = detail.HotelName || '';
                    hotelContent.address = detail.Address || '';
                    hotelContent.city = detail.CityName || '';
                    hotelContent.cityCode = cityCode;
                    hotelContent.countryCode = detail.CountryCode || '';
                    hotelContent.latitude = detail.Map ? detail.Map.split('|')[0] : null;
                    hotelContent.longitude = detail.Map ? detail.Map.split('|')[1] : null;
                    hotelContent.rating = detail.HotelRating || null;
                    entity.providerCode = 'TBO';
                    // add more fields as needed

                    hotelContentEntities.push(hotelContent);


                    // Create HotelAdditionalDetailsEntity to hold additional hotel details
                    const additionalDetail = new TboHotelAdditionalDetailsEntity();
                    additionalDetail.hotelCode = detail.HotelCode;
                    additionalDetail.supplierCode = 'TBO'; // Assuming you have a supplier code
                    additionalDetail.hotelName = detail.HotelName || '';
                    additionalDetail.rating = detail.HotelRating || null;
                    additionalDetail.latitude = detail.Map ? detail.Map.split('|')[0] : null;
                    additionalDetail.longitude = detail.Map ? detail.Map.split('|')[1] : null;
                    additionalDetail.address = detail.Address || '';
                    additionalDetail.city = detail.CityName || '';
                    additionalDetail.state = '';  // Set to empty or pull from detail if available
                    additionalDetail.country = detail.CountryName || '';
                    additionalDetail.cityCode = cityCode; // Assuming you might pull this from elsewhere
                    additionalDetail.stateCode = ''; // Assuming you might pull this from elsewhere
                    additionalDetail.countryCode = detail.CountryCode || '';
                    additionalDetail.pincode = detail.PinCode || ''; // Pin code from the API response
                    additionalDetail.heroImage = detail.Image || ''; // Set the image as heroImage
                    additionalDetail.amenities = detail.HotelFacilities || []; // Map HotelFacilities to amenities
                    additionalDetail.description = detail.description; // Add hotel descriptions if available
                    additionalDetail.hotelEmail = detail.Email || ''; // Add hotel email if available
                    additionalDetail.hotelPhones = detail.PhoneNumber ? [detail.PhoneNumber] : []; // Add phone numbers if available
                    additionalDetail.boardCodes = []; // Add board codes if available
                    additionalDetail.websiteUrl = detail.HotelWebsiteUrl || ''; // Hotel website URL
                    additionalDetail.interestPoints = detail.Attractions ? Object.values(detail.Attractions):[]; // Attractions as interest points
                    additionalDetail.terminals = []; // Add terminals if available
                    additionalDetail.createdAt = new Date();
                    additionalDetail.updatedAt = new Date();
                    additionalDetail.hotelVector = ''; // You might generate this or set it based on your data
                    additionalDetail.hotelNameNormalized = detail.HotelName?.toLowerCase() || null;

                    hotelAdditionalDetailsEntities.push(additionalDetail);



                     // --- HOTEL IMAGES ---
                    if (detail.Images && Array.isArray(detail.Images)) {
                    let order = 1;
                    for (const imgUrl of detail.Images) {
                        const imageEntity = new TboHotelImagesEntity();
                        imageEntity.hotelCode = detail.HotelCode;
                        imageEntity.supplierCode = 'TBO';
                        imageEntity.typeCode = 'EXTERIOR'; // or extract from API if available
                        imageEntity.typeName = ''; //
                        imageEntity.roomCode = '';
                        imageEntity.roomType = '';
                        imageEntity.url = imgUrl;
                        imageEntity.order = order++;
                        imageEntity.visualOrder = order;
                        imageEntity.createdAt = new Date();
                        imageEntity.updatedAt = new Date();

                        hotelImagesEntities.push(imageEntity);
                    }
                    }
                }
            }

            // Step 5: Save entities in chunks to DB
            await this.hotelMasterRepository.save(hotelEntities, { chunk: 100 });
            await this.hotelContentRepository.save(hotelContentEntities, { chunk: 100 });
            await this.hotelDetailsRepository.save(hotelAdditionalDetailsEntities, {chunk:100}); 
            await this.hotelImagesRepository.save(hotelImagesEntities, { chunk: 100 });

            this.logger.log(`Successfully added ${hotelEntities.length} hotels with full details`);

            return {
                success: true,
                message: `Hotel details added successfully: ${hotelEntities.length} hotels`,
            };
        } catch (error) {
            this.logger.error('Error in addHotelList:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to add hotel list');
        }
    }

    //      /**
    //      * Add hotel list dump from TBO API
    //      * @author: Qamar Ali - 22-10-2025
    //      * @param headers - Request headers
    //      * @returns Promise<CommonResponse> - Dump result
    //      */
    //     async addHotelList(headers: Headers): Promise<CommonResponse> {
    //     try {
    //         this.logger.log('Starting hotel list dump from TBO API');

    //         const providersData = await this.supplierCredService.getActiveProviders(headers);
    //         const tboProvider = providersData.find((p) => p.code === 'TBO');

    //         if (!tboProvider) {
    //             throw new BadRequestException('TBO provider not found');
    //         }

    //         const providerCredentials = JSON.parse(tboProvider.provider_credentials);
    //         console.log(providerCredentials,"providerCredentials")
    //         const auth = {
    //             username: providerCredentials.username,
    //             password: providerCredentials.password,
    //             // username: "TBOStaticAPITest",
    //             // password: "Tbo@11530818",
    //         };

    //         const allCities = await this.cityRepository.find();
    //         const endpoint = `${providerCredentials.dump_url}/TBOHotelCodeList`;

    //         const chunkSize = 1000;
    //         let totalHotelsAdded = 0;

    //         for (let i = 0; i < allCities.length; i += chunkSize) {
    //             const cityChunk = allCities.slice(i, i + chunkSize);
    //             const hotelList: HotelMasterEntity[] = [];

    //             const results = await Promise.allSettled(
    //                 cityChunk.map(city =>
    //                     Http.httpRequestTBOHotel('POST', endpoint, { CityCode: city.cityCodeTbo }, auth)
    //                         .then(response => {
    //                             if (!response.Hotels || !Array.isArray(response.Hotels)) {
    //                                 this.logger.warn(`No hotel found for city-code ${city.cityCodeTbo}`);
    //                                 return [];
    //                             }

    //                             return response.Hotels.map(hotel => {
    //                                 const entity = new HotelMasterEntity();
    //                                 entity.hotelName = hotel.HotelName;
    //                                 entity.hotelCode = hotel.HotelCode;
    //                                 entity.countryCode = hotel.CountryCode;
    //                                 entity.city = hotel.CityName;
    //                                 entity.latitude = hotel.Latitude ?? 0;
    //                                 entity.longitude = hotel.Longitude ?? 0;
    //                                 entity.providerCode = 'TBO';
    //                                 entity.hotelSource = HotelSourceEnum.TBO;
    //                                 entity.isActive = true;
    //                                 entity.isDeleted = false;
    //                                 entity.createdAt = new Date();
    //                                 return entity;
    //                             });
    //                         })
    //                         .catch(error => {
    //                             this.logger.error(`Failed to fetch hotel for city ${city.cityCodeTbo}:`, error);
    //                             return [];
    //                         })
    //                 )
    //             );

    //             for (const result of results) {
    //                 if (result.status === 'fulfilled') {
    //                     hotelList.push(...result.value);
    //                 }
    //             }

    //             if (hotelList.length > 0) {
    //                 await this.hotelMasterRepository.save(hotelList, { chunk: 100 });
    //                 totalHotelsAdded += hotelList.length;
    //                 this.logger.log(`Saved ${hotelList.length} hotels for cities [${i} - ${i + chunkSize}]`);
    //             }
    //         }

    //         if (totalHotelsAdded === 0) {
    //             throw new BadRequestException('No hotel found in any API response');
    //         }

    //         this.logger.log(`Successfully added ${totalHotelsAdded} hotels`);
    //         return {
    //             success: true,
    //             message: `Hotel list added successfully: ${totalHotelsAdded} hotels`,
    //         };
    //     } catch (error) {
    //         this.logger.error('Error in addHotelList:', error);
    //         if (error instanceof BadRequestException) {
    //             throw error;
    //         }
    //         throw new InternalServerErrorException('Failed to add hotel list');
    //     }
    // }
}
