import { Injectable } from '@nestjs/common';
import { ProviderOrderDetailService } from '../providers/provider-order-detail.service';
import { OrderDetailResponse } from './interfaces/order-detail.interface';
import { OrderDetailDto } from './dtos/order-detail.dto';

@Injectable()
export class OrderDetailService {
    constructor(private readonly providerOrderDetailService: ProviderOrderDetailService) {}

    /** [@Description: This method is used to get the order details]
     * @author: Prashant Joshi at 23-09-2025 **/
    async getOrderDetails(orderReq: OrderDetailDto, headers: Headers): Promise<OrderDetailResponse> {
        let response = await this.providerOrderDetailService.providerOrderDetail({ orderReq, headers });
        return response;
    }
}
