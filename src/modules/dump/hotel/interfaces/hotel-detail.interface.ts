/**
 * Hotel detail interfaces for dump operations
 * @author Prashant - TBO Integration
 */

export interface HotelAmenity {
    amenityCode: string;
    amenityName: string;
    amenityType: string;
}

export interface HotelImageSizes {
    imageType: string;
    imagePath: string;
    imageOrder: number;
    imageSize: string;
}

export interface HotelDetailData {
    hotelCode: string;
    hotelName: string;
    rating: number;
    latitude: string;
    longitude: string;
    address: string;
    city: string;
    state: string;
    country: string;
    cityCode: string;
    stateCode: string;
    countryCode: string;
    pincode: string;
    heroImage: string;
    description: string;
    facilities: string[];
    policies: string[];
    amenities: HotelAmenity[];
    boardCodes: Array<{
        boardCode: string;
        boardName: string;
    }>;
    images: HotelImageSizes[];
}

export interface HotelDetailResponse {
    success: boolean;
    message: string;
    data: HotelDetailData;
}
