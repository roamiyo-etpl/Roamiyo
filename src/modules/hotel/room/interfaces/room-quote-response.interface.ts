import { CancellationPolicy } from "../../search/interfaces/initiate-result-response.interface";

export interface HotelRoomQuoteResponse {
    uniqueId: string;
    remarks: string;
    price: number;
    status: string;
    cancellationPolicy: CancellationPolicy;
}
