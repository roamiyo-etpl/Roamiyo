import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { BookResponse, Order } from '../../book/interfaces/book.interface';
import { BookDto } from '../../book/dtos/book.dto';
import { TboAuthTokenService } from './tbo-auth-token.service';
import { AirlineCategory, Currencies, TripType } from 'src/shared/enums/flight/flight.enum';
import { BookingStatus } from 'src/shared/enums/flight/booking.enum';
import { s3BucketService } from 'src/shared/utilities/flight/s3bucket.utility';
import { GenericRepo } from 'src/shared/utilities/flight/generic-repo.utility';
import { Http } from 'src/shared/utilities/flight/http.utility';
import { Generic } from 'src/shared/utilities/flight/generic.utility';
import moment from 'moment';
import { RevalidateResponseEntity } from 'src/shared/entities/revalidate-response.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderDetailResponse } from '../../order-details/interfaces/order-detail.interface';
import { SupplierLogUtility } from 'src/shared/utilities/flight/supplier-log.utility';
@Injectable()
export class TboBookService {
    logDate = Date.now();
    constructor(
        private readonly tboAuthTokenService: TboAuthTokenService,
        private s3Service: s3BucketService,
        private genericRepo: GenericRepo,
        @InjectRepository(RevalidateResponseEntity) private revalidateRepo: Repository<RevalidateResponseEntity>,
        private readonly supplierLogUtility: SupplierLogUtility,
    ) {}

    /** [@Description: This method is used to book the flights]
     * @author: Prashant Joshi at 13-10-2025 **/
    async book(bookRequest): Promise<BookResponse | void> {
        const { bookReq }: { bookReq: BookDto } = bookRequest;
        const bookResponse = new BookResponse();

        Object.assign(bookRequest, { tokenReqData: bookReq, searchReqID: bookReq.searchReqID });
        try {
            /* get authentication token*/
            const authToken = await this.tboAuthTokenService.getAuthToken(bookRequest);
            const handleAuthenticationFailure = () => {
                const bookResponse: BookResponse = {
                    error: true,
                    message: 'There is no flight available.',
                    searchReqID: bookReq.searchReqID,
                    // hashReqKey: bookReq.hashReqKey,
                    orderDetail: [],
                    orderDetails: new OrderDetailResponse(),
                    mode: 'TBO-' + bookRequest.providerCred.mode,
                };
                return bookResponse;
            };

            /* In case there is an issue in authentication from the provider */
            if (authToken === '' || bookRequest?.redisData?.data?.length === 0) {
                return handleAuthenticationFailure();
            }

            let result;

            if (bookReq.airTripType.toLowerCase() === TripType.ROUNDTRIP && bookReq.solutionId?.includes('|||')) {
                console.log('ROUND TRIP');
                result = await this.createMultipleBook({ bookRequest, handleAuthenticationFailure });
            } else {
                console.log('ONE WAY');
                result = await this.createSingleBook({ bookRequest, index: 0, handleAuthenticationFailure });
            }

            let oneOrderSuccess = false;
            let message = '';

            bookResponse.orderDetail = [];
            // Store raw supplier responses for audit trail
            const rawSupplierResponses: Array<{ request: any; response: any }> = [];

            if (Array.isArray(result)) {
                for (const data of result) {
                    const order = new Order();
                    /* Logging the data */
                    const logs = {
                        ApiRequest: bookReq,
                        ApiResponse: data?.ticketingResult,
                        supplierRequest: data?.requestBodyTicketing,
                        supplierResponse: data?.ticketingResult,
                    };
                    // this.supplierLogs.addSupplierLogs(bookReq.searchReqID, logs, 'TBO', 'book-ticketing');

                    // Store raw supplier response
                    rawSupplierResponses.push({
                        request: data?.requestBodyTicketing,
                        response: data?.ticketingResult,
                    });

                    /* Check if Ticketing is successful and Setting order details */
                    if (data?.ticketingResult?.Response?.ResponseStatus === 1) {
                        order.orderNo = data.ticketingResult.Response?.Response?.BookingId;
                        order.supplierBaseAmount = data.ticketingResult.Response?.Response?.FlightItinerary?.Fare?.BaseFare || 0;
                        // order.orderAmount = bookReq?.paymentDetails?.totalFare;
                        // order.currency = bookReq?.paymentDetails?.currencyCode;
                        order.orderStatus = BookingStatus.CONFIRMED;
                        order.pnr = data.ticketingResult?.Response?.Response.PNR || '';
                        oneOrderSuccess = true;
                    } else {
                        order.orderStatus = BookingStatus.FAILED;
                        message = data.ticketingResult?.Errors?.[0]?.UserMessage;
                    }
                    bookResponse.orderDetail.push(order);
                }
            }

            // Store raw supplier response in BookResponse
            bookResponse.rawSupplierResponse = rawSupplierResponses;

            if (oneOrderSuccess) {
                bookResponse.error = false;
                bookResponse.message = 'Booking successful.';
                bookResponse.searchReqID = bookReq.searchReqID;
                bookResponse.mode = 'TBO-' + bookRequest.providerCred.mode;
            } else {
                Object.assign(bookResponse, {
                    error: true,
                    message: message || 'This flight is not available.',
                    searchReqID: bookReq.searchReqID,
                    mode: 'TBO-' + bookRequest.providerCred.mode,
                });
            }

            return bookResponse;
        } catch (error) {
            console.log('BOOKING ERROR', error);
            /* error logging */
            const errorLog = {};
            Object.assign(errorLog, { error: error.stack });
            const logs = { ApiRequest: bookRequest.bookReq, TypeError: errorLog };
            // await this.s3Service.generateS3LogFile(bookReq.searchReqID + '-' + this.logDate + '-TBO-BookingError', logs, 'book');

            this.genericRepo.storeLogs(bookReq.searchReqID, 1, error, 0);
            throw new InternalServerErrorException(`ERR_ISSUE_IN_FETCHING_DATA_FROM_PROVIDER`);
        }
    }

    /** [@Description: This method is used to create the single book]
     * @author: Prashant Joshi at 13-10-2025 **/
    async createSingleBook(reqParams): Promise<{ ticketingResult: any; requestBodyTicketing?: any }[]> {
        const { bookRequest, index = 0, handleAuthenticationFailure } = reqParams;
        const { providerCred } = bookRequest;
        const { bookReq }: { bookReq: BookDto } = bookRequest;
        const bookResponse = new BookResponse();
        const order = new Order();

        // Get solutionId from the correct location
        const solutionId = bookReq.solutionId;

        console.log('Looking for revalidate with solution_id:', solutionId);
        console.log('Provider:', providerCred.provider);

        const revalidateResponse = await this.revalidateRepo.findOne({
            where: {
                solution_id: solutionId,
                provider_code: providerCred.provider,
            },
        });

        if (!revalidateResponse) {
            console.error('Revalidate response not found for solution_id:', solutionId);
            return handleAuthenticationFailure?.();
        }

        console.log('Revalidate response found:', !!revalidateResponse);
        const res = JSON.parse(revalidateResponse.response);
        const fareBreakDown = res.Response.Results?.FareBreakdown;
        const isLCC = res.Response.Results.IsLCC;

        // Use ResultIndex from revalidate response (this is the updated/confirmed solutionId from TBO)
        const revalidateResultIndex = res.Response.Results?.ResultIndex;
        // console.log('Original solutionId:', solutionId);
        // console.log('Revalidate ResultIndex:', revalidateResultIndex);

        // Update bookReq with revalidate ResultIndex for booking API
        if (revalidateResultIndex) {
            bookReq.solutionId = revalidateResultIndex;
        }

        Object.assign(bookRequest, {
            tokenReqData: bookReq,
            searchReqID: bookReq.searchReqID,
            trackingId: bookReq.trackingId,
            fareBreakDown,
            airlineType: isLCC ? 'LCC' : 'Non-LCC',
        });
        let pnr: string = '';
        let bookingId: string = '';
        let bookTraceId: string = '';

        /* Check if booking is Non LCC create initiate the book API call */
        if (!isLCC) {
            const requestBody = await this.createBookRequest({ bookRequest, pnr, bookingId, bookTraceId, index });
            const endpoint = `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/Book`;
            const bookResult = await Http.httpRequestTBO('POST', endpoint, JSON.stringify(requestBody));
            console.log('requestBody BOOK \n', JSON.stringify(requestBody), '\n');
            console.log('BOOKING RESULT \n', JSON.stringify(bookResult), '\n');
            /* Logging the data */
            const logs = {
                ApiRequest: bookReq,
                ApiResponse: bookResult,
                supplierRequest: requestBody,
                supplierResponse: bookResult,
            };
            // await this.s3Service.generateS3LogFile(bookReq.searchReqID + '-' + index + '-' + this.logDate + 'book-TBO', logs, 'book');
            // this.supplierLogs.addSupplierLogs(bookReq.searchReqID, logs, 'TBO', 'book');
            await this.supplierLogUtility.generateLogFile({
                fileName: bookReq.searchReqID + '-' + index + '-' + this.logDate + 'book-TBO',
                logData: logs,
                folderName: 'book',
                logId: bookRequest.logId,
                title: 'Book-TBO',
                searchReqId: bookReq.searchReqID,
                bookingReferenceId: null,
            });
            /* Check if booking is successful */
            if (bookResult.Response.ResponseStatus !== 1) {
                const message = bookResult?.Errors?.[0]?.UserMessage || 'This flight is not available.';

                order.orderStatus = BookingStatus.FAILED;
                Object.assign(bookResponse, {
                    error: true,
                    message: message,
                    orderDetail: order,
                    searchReqID: bookReq.searchReqID,
                    mode: 'TBO-' + bookRequest.providerCred.mode,
                });

                return [{ ticketingResult: bookResponse }] as any;
            }

            /* Updating PNR variable */
            pnr = bookResult.Response.Response.PNR || '';
            bookingId = bookResult.Response.Response.BookingId || '';
            bookTraceId = bookResult.Response.TraceId || '';
        }

        /* Ticketing API for the LCC book */
        return await this.ticketingCall({ bookRequest, pnr, bookingId, bookTraceId, index, supplierResult: null });
    }

    /** [@Description: This method is used to create the ticketing call]
     * @author: Prashant Joshi at 13-10-2025 **/
    async ticketingCall(reqParams) {
        const { bookRequest, pnr, bookingId, bookTraceId, index, supplierResult = null } = reqParams;
        const { providerCred } = bookRequest;
        const startTime = Date.now();
        /* Ticketing API for the LCC book */
        const requestBodyTicketing = await this.createBookRequest({ bookRequest, pnr, bookingId, bookTraceId, index, supplierResult });

        const endpointTicketing = `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/Ticket`;
        const ticketingResult = await Http.httpRequestTBO('POST', endpointTicketing, JSON.stringify(requestBodyTicketing));
        const endTime = Date.now();
        const responseTimeMs = endTime - startTime;

        console.log('requestBodyTicketing \n', JSON.stringify(requestBodyTicketing), '\n');
        console.log('TICKITING RESULT \n', JSON.stringify(ticketingResult), '\n');

        const logs = {
            ApiRequest: bookRequest.bookReq,
            ApiResponse: ticketingResult,
            supplierRequest: requestBodyTicketing,
            supplierResponse: ticketingResult,
        };
        // await this.s3Service.generateS3LogFile(bookRequest.searchReqID + '-' + index + '-' + this.logDate + 'ticketing-TBO', logs, 'book');
        await this.supplierLogUtility.generateLogFile({
            fileName: bookRequest.searchReqID + '-' + index + '-' + this.logDate + 'ticketing-TBO',
            logData: logs,
            folderName: 'book',
            logId: bookRequest.logId,
            title: 'Ticketing-TBO',
            searchReqId: bookRequest.searchReqID,
            bookingReferenceId: null,
        });
        //if price and time updated then cancel booking
        if (ticketingResult?.Response?.Response?.IsPriceChanged || ticketingResult?.Response?.Response?.IsTimeChanged) {
            this.ticketingCall({ bookRequest, pnr, bookingId, bookTraceId, index, supplierResult: ticketingResult });
            // ticketingResult.Response.ResponseStatus = 2;
        }
        return [{ ticketingResult, requestBodyTicketing }] as any;
    }

    /** [@Description: This method is used to create the multiple book]
     * @author: Prashant Joshi at 13-10-2025 **/
    async createMultipleBook(reqParams) {
        const { bookRequest, handleAuthenticationFailure } = reqParams;
        const { bookReq }: { bookReq: BookDto } = bookRequest;

        // Split the solutionId based on "|||"
        const solutionIds = bookReq.solutionId.split(' ||| ');

        const bookingResults: any[] = [];

        for (const [i, solutionId] of solutionIds.entries()) {
            const trimmedSolutionId = solutionId.trim();

            const selectedSegment = bookReq.routes[i];
            const airlineType = bookReq.airlineType;

            // Prepare updated book request for the current solution ID
            const updatedBookRequest = {
                ...bookRequest,
                bookReq: {
                    ...bookReq,
                    solutionId: trimmedSolutionId,
                    selectedSegment,
                    airlineType,
                },
            };

            // Call the createSingleBook function
            const result = await this.createSingleBook({ bookRequest: updatedBookRequest, index: i, handleAuthenticationFailure });
            if (Array.isArray(result)) {
                //if first booking is failed then return error, not attempt second booking
                if (i === 0 && (result[0]?.ticketingResult?.error || result[0]?.ticketingResult?.Response?.ResponseStatus != 1)) {
                    return result;
                }
                bookingResults.push(...result);
            }
        }
        return bookingResults;
    }

    /** [@Description: This method is used to create the book request]
     * @author: Prashant Joshi at 13-10-2025 **/
    async createBookRequest(reqParams) {
        const { bookRequest, pnr, bookingId, bookTraceId, index: idx = 0, supplierResult = null } = reqParams;
        const fareBreakDown = bookRequest?.FareBreakdown;

        const { bookReq, headers } = bookRequest;

        const passengers = bookReq.passengers;

        /* Create passenger array */
        const passengerArray = passengers.map((element, index) => {
            const pexT = element?.passengerType === 'ADT' ? 1 : element?.passengerType === 'CHD' ? 2 : 3;

            // get pex fare from DB fare breakdown
            const fare = fareBreakDown?.find((f) => f?.PassengerType === pexT);

            return {
                Title: element?.passengerDetail?.title || 'Mr',
                FirstName: element?.passengerDetail?.firstName.trim(),
                LastName: element?.passengerDetail?.lastName.trim(),
                PaxType: pexT,
                DateOfBirth: moment(element?.dateOfBirth, 'YYYY-MM-DD').format('YYYY-MM-DDTHH:mm:ss'),
                Gender: element.gender == 'M' ? 1 : 2,
                PassportNo: element?.document?.documentNumber,
                PassportExpiry: element?.document?.expiryDate,
                PassportIssueDate: element?.document?.issueDate,
                PassportIssueCountryCode: element?.document?.country,
                AddressLine1: `${element?.city?.name || ''}, ${element?.country?.name || ''}, ${bookReq?.contact?.postalCode}`,
                AddressLine2: '',
                City: element?.city?.name,
                CountryName: element?.country?.name,
                CountryCode: element?.document?.country,
                Nationality: element?.nationality,
                GSTCompanyAddress: bookReq?.gst?.gstCompanyAddress || '',
                GSTCompanyContactNumber: bookReq?.gst?.gstCompanyContactNumber || '',
                GSTCompanyName: bookReq?.gst?.gstCompanyName || '',
                GSTNumber: bookReq?.gst?.gstNumber || '',
                GSTCompanyEmail: bookReq?.gst?.gstCompanyEmail || '',
                ContactNo: element.mobile.replace('+', '').trim(),
                CellCountryCode: element?.mobileCountryCode,
                Email: element?.email || bookReq?.contact?.email,
                IsLeadPax: index === 0,
                FFAirlineCode: null,
                FFAirline: null,
                FFNumber: null,
                Fare: {
                    Currency: fare?.Currency,
                    BaseFare: fare?.BaseFare / (fare?.PassengerCount || 1) || 0,
                    Tax: fare?.Tax / (fare?.PassengerCount || 1) || 0,
                    YQTax: fare?.YQTax / (fare?.PassengerCount || 1) || 0,
                    AdditionalTxnFeeOfrd: fare?.AdditionalTxnFeeOfrd / (fare?.PassengerCount || 1) || 0,
                    AdditionalTxnFeePubL: fare?.AdditionalTxnFeePubL / (fare?.PassengerCount || 1) || 0,
                    PGCharge: fare?.PGCharge / (fare?.PassengerCount || 1) || 0,
                },
            };
        });

        const authToken = await this.tboAuthTokenService.getAuthToken(bookRequest);
        let obj: any = {};

        if (pnr) {
            obj = {
                TokenId: authToken,
                TraceId: bookTraceId,
                PNR: pnr,
                BookingId: bookingId,
                EndUserIp: headers['ip-address'],
            };
        } else {
            obj = {
                TokenId: authToken,
                TraceId: bookReq?.trackingId,
                ResultIndex: bookReq?.solutionId,
                EndUserIp: headers['ip-address'],
                Passengers: passengerArray,
            };
            console.log('Ticketing API Request - ResultIndex:', bookReq?.solutionId);
        }

        if (supplierResult?.Response?.Response?.IsPriceChanged) {
            obj.IsPriceChangeAccepted = true;
        }

        if (supplierResult?.Response?.Response?.IsTimeChanged) {
            obj.IsPriceChangeAccepted = true;
        }

        return obj;
    }
}
