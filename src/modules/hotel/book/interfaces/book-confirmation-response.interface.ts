export class HotelBookConfirmationResponse {
    success: boolean;
    message: string;
    data: {
        bookingRefId: string;
        supplierBookingId: string;
        supplierCode: string;
        bookingStatus: string;
        bookingData: BookingData;
    };
}

export interface BookingData {
    bookingId: string;
    bookingDate: string;
    bookingAmount: number;
    bookingCurrency: string;
    bookingStatus: string;
}
