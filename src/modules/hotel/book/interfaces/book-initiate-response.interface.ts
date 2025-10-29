export interface HotelBookInitiateResponse {
    success: boolean;
    message: string;
    data: {
        bookingRefId: string;
    };
}
