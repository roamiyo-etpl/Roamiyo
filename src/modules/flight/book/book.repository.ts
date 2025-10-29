import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Booking, BookingFrom, BookingStatus, JourneyType } from 'src/shared/entities/bookings.entity';
import { BookDto, Passenger } from './dtos/book.dto';
import { PassengerType } from 'src/shared/enums/flight/flight.enum';
import { BookingLog, PaymentStatus } from 'src/shared/entities/booking-logs.entity';
import { BookResponse, Order } from './interfaces/book.interface';
import { BookingAdditionalDetail, AddBookingType } from 'src/shared/entities/booking-additional-details.entity';
import { OrderDetailResponse } from '../order-details/interfaces/order-detail.interface';
import { FareRules } from '../revalidate/interfaces/revalidate.interface';
import { DuplicateBookingException } from './exceptions/duplicate-booking.exception';
import { v4 as uuidv4 } from 'uuid';
import { Generic } from 'src/shared/utilities/flight/generic.utility';

@Injectable()
export class BookRepository extends Repository<Booking> {
    constructor(private readonly dataSource: DataSource) {
        super(Booking, dataSource.createEntityManager());
    }

    /**
     * Check for duplicate booking request
     * Prevents multiple bookings with same details when status is PENDING or INPROGRESS
     */
    async checkDuplicateBooking(reqParams): Promise<Booking | null> {
        const { booking, userId } = reqParams;
        // Extract route details
        const firstRoute = booking.routes[0];
        const outboundSegments = firstRoute.route_0;
        const firstSegment = outboundSegments[0];
        const lastSegment = outboundSegments[outboundSegments.length - 1];

        // Calculate passenger counts
        const adultCount = booking.passengers.filter((p) => p.passengerType === PassengerType.ADULT).length;
        const childCount = booking.passengers.filter((p) => p.passengerType === PassengerType.CHILD).length;
        const infantCount = booking.passengers.filter((p) => p.passengerType === PassengerType.INFANT).length;

        console.log(firstSegment.departureDate);
        // Search for existing bookings with same criteria
        const existingBooking = await this.createQueryBuilder('booking')
            .where('booking.user_id = :userId', { userId })
            .andWhere('booking.origin_code @> ARRAY[:origin]::text[]', { origin: firstSegment.departureCode })
            .andWhere('booking.destination_code @> ARRAY[:destination]::text[]', { destination: lastSegment.arrivalCode })
            .andWhere('DATE(booking.checkin) = DATE(:checkin)', { checkin: new Date(firstSegment.departureDate) })
            .andWhere('DATE(booking.checkout) = DATE(:checkout)', { checkout: new Date(lastSegment.arrivalDate) })
            .andWhere('booking.supplier_name = :supplier', { supplier: booking.providerCode })
            .andWhere('booking.booking_status IN (:...statuses)', {
                statuses: [BookingStatus.PENDING, BookingStatus.INPROGRESS],
            })
            .andWhere('booking.journey_type = :journeyType', { journeyType: booking.airTripType })
            // Check passenger count matches
            .andWhere("(booking.paxes->0->'adult'->>'count')::int = :adultCount", { adultCount })
            .andWhere("(booking.paxes->0->'child'->>'count')::int = :childCount", { childCount })
            .andWhere("(booking.paxes->0->'infant'->>'count')::int = :infantCount", { infantCount })
            .orderBy('booking.created_at', 'DESC')
            .getOne();

        return existingBooking;
    }

    /** [@Description: This method is used to initiate the booking]
     * @author: Prashant Joshi at 13-10-2025 **/
    async insertBooking(reqParams): Promise<Booking> {
        const { booking, userId, mwrLogId } = reqParams;

        const bookingEntity = new Booking();

        // Map basic fields
        bookingEntity.supplier_name = booking.providerCode;
        bookingEntity.booking_date = new Date();
        bookingEntity.booking_status = BookingStatus.INPROGRESS; // INPROGRESS

        // Map journey type
        bookingEntity.journey_type = booking.airTripType as any;

        // Map contact details

        bookingEntity.contact_details = {
            title: booking.contact.title,
            firstName: booking.contact.firstName,
            middleName: booking.contact.middleName || '',
            lastName: booking.contact.lastName,
            gender: booking.contact.gender,
            email: booking.contact.email,
            mobileCountryCode: booking.contact.mobileCountryCode,
            mobileNumber: parseInt(booking.contact.mobile),
        };

        // Extract origin and destination from routes
        const firstRoute = booking.routes[0];
        const outboundSegments = firstRoute.route_0;
        const firstSegment = outboundSegments[0];
        const lastSegment = outboundSegments[outboundSegments.length - 1];

        bookingEntity.origin_code = [firstSegment.departureCode];
        bookingEntity.destination_code = [lastSegment.arrivalCode];

        // Set check-in/checkout dates from departure and arrival
        bookingEntity.checkin = new Date(firstSegment.departureDate);
        bookingEntity.checkout = new Date(lastSegment.arrivalDate);

        // Map passenger counts
        const adultCount = booking.passengers.filter((p) => p.passengerType === PassengerType.ADULT).length;
        const childCount = booking.passengers.filter((p) => p.passengerType === PassengerType.CHILD).length;
        const infantCount = booking.passengers.filter((p) => p.passengerType === PassengerType.INFANT).length;

        bookingEntity.paxes = [
            {
                adult: { count: adultCount, ages: [Generic.calculateAge(booking.passengers[0].dateOfBirth)] },
                child: { count: childCount, ages: [Generic.calculateAge(booking.passengers[0].dateOfBirth)] },
                infant: { count: infantCount, ages: [Generic.calculateAge(booking.passengers[0].dateOfBirth)] },
            },
        ];

        bookingEntity.user_id = userId;
        bookingEntity.legacy_booking_id = 0;
        bookingEntity.module_type = 1;
        bookingEntity.mwr_log_id = mwrLogId;
        bookingEntity.booking_reference_id = `TA-${Generic.generateRandomString()}`;

        return this.save(bookingEntity);
    }

    /** [@Description: This method is used to get the booking by booking id]
     * @author: Prashant Joshi at 13-10-2025 **/
    async getBookingByBookingId(reqParams): Promise<Booking> {
        const { bookingId } = reqParams;
        const booking = await this.findOne({ where: { booking_id: bookingId } });
        if (!booking) {
            throw new Error('Booking not found');
        }
        return booking;
    }

    /** [@Description: This method is used to store the booking log]
     * @author: Prashant Joshi at 13-10-2025 **/
    async storeBookingLog(reqParams): Promise<BookingLog> {
        const { bookingRefId, userId, mwrLogId } = reqParams;

        /* create booking log */
        const bookingLog = new BookingLog();
        bookingLog.log_id = mwrLogId;
        bookingLog.booking_reference_id = bookingRefId;
        bookingLog.user_id = userId;
        bookingLog.data = {};
        bookingLog.is_verified = false;
        bookingLog.payment_status = PaymentStatus.PENDING;
        bookingLog.transaction_id = null;
        bookingLog.created_at = new Date();
        bookingLog.updated_at = new Date();
        return this.dataSource.getRepository(BookingLog).save(bookingLog);
    }

    /** [@Description: This method is used to get the booking log by booking log id]
     * @author: Prashant Joshi at 13-10-2025 **/
    async getBookingLogByBookingLogId(reqParams): Promise<BookingLog> {
        const { bookingLogId } = reqParams;
        // Validate bookingLogId
        if (!bookingLogId) {
            throw new Error('Booking log ID is required');
        }

        // Parse to integer and validate
        const logId = bookingLogId;
        console.log('logId', logId);

        const bookingLog = await this.dataSource.getRepository(BookingLog).findOne({ where: { log_id: logId, is_verified: false } });
        if (!bookingLog) {
            throw new Error(`Booking log not found with ID: ${logId}`);
        }
        return bookingLog;
    }

    /** [@Description: This method is used to update the booking log data]
     * @author: Prashant Joshi at 13-10-2025 **/
    async updateBookingLogData(reqParams): Promise<BookingLog> {
        const { bookingLogId, data } = reqParams;
        const bookingLog = await this.dataSource.getRepository(BookingLog).findOne({ where: { id: bookingLogId } });
        if (!bookingLog) {
            throw new Error('Booking log not found');
        }
        bookingLog.data = data;
        return this.dataSource.getRepository(BookingLog).save(bookingLog);
    }

    /** [@Description: This method is used to update the booking with supplier response and order details
     * Maps all available fields from supplier and order detail API responses
     * Also creates booking additional details with must-have data]
     * @author: Prashant Joshi at 13-10-2025 **/
    async updateBookingWithSupplierDetails(reqParams): Promise<Booking> {
        const { bookingId, supplierDetails, apiRequest, supplierResponse, bookingItem = 1 } = reqParams;
        const booking = await this.findOne({ where: { booking_id: bookingId } });
        if (!booking) {
            throw new Error('Booking not found');
        }

        // Extract order detail from supplier response
        const orderDetail = supplierDetails.orderDetail?.[0];
        const orderDetails = supplierDetails.orderDetails;

        if (orderDetail) {
            // Map supplier reference data
            booking.supplier_reference_id = orderDetail.orderNo || '';

            // Update booking status based on order status
            if (orderDetail.orderStatus === 'CONFIRMED') {
                booking.booking_status = BookingStatus.CONFIRMED;
            } else {
                booking.booking_status = BookingStatus.PENDING;
            }

            // Map pricing details
            if (orderDetail.orderAmount) {
                booking.total = orderDetail.orderAmount;
                booking.public_price = orderDetail.orderAmount;
            }

            if (orderDetail.currency) {
                booking.currency_code = orderDetail.currency;
            }

            if (orderDetail.supplierBaseAmount) {
                booking.net_price = parseFloat(orderDetail.supplierBaseAmount);
            }

            // Map fare type
            if (orderDetail.fareType) {
                // Store fare type in additional details or create a new field if needed
            }

            // Check if price or schedule changed
            if (orderDetail.isPriceChanged || orderDetail.isScheduleChanged) {
                // Handle price/schedule changes - might need to notify user
                console.warn('Price or schedule changed for booking:', bookingId);
            }
        }

        // Map order details data if available
        if (orderDetails && !orderDetails.error) {
            // Map booking reference and PNR
            if (orderDetails.bookingRefNumber) {
                booking.booking_reference_id = orderDetails.bookingRefNumber;
            }

            if (orderDetails.pnr) {
                // PNR can be stored in additional details or you can add a field
                // For now, we'll ensure supplier_reference_id has this
                if (!booking.supplier_reference_id) {
                    booking.supplier_reference_id = orderDetails.pnr;
                }
            }

            // Map booking status
            if (orderDetails.bookingStatus) {
                // Map string status to enum
                const statusMap = {
                    confirmed: BookingStatus.CONFIRMED,
                    booked: BookingStatus.BOOKED,
                    pending: BookingStatus.PENDING,
                    cancelled: BookingStatus.CANCELLED,
                    failed: BookingStatus.FAILED,
                };
                const mappedStatus = statusMap[orderDetails.bookingStatus.toLowerCase()];
                if (mappedStatus !== undefined) {
                    booking.booking_status = mappedStatus;
                }
            }

            // Map fare details from routes
            if (orderDetails.routes?.fare && orderDetails.routes.fare.length > 0) {
                const fare = orderDetails.routes.fare[0];

                // Map pricing from fare
                if (fare.totalFare) {
                    booking.total = fare.totalFare;
                }

                if (fare.sellingPrice) {
                    booking.public_price = fare.sellingPrice;
                }

                if (fare.baseFare) {
                    booking.net_price = fare.baseFare;
                }

                if (fare.tax) {
                    booking.tax = fare.tax;
                }

                if (fare.currency) {
                    booking.currency_code = fare.currency;
                }

                // Calculate savings (if selling price exists)
                if (fare.sellingPrice && fare.totalFare && fare.sellingPrice > fare.totalFare) {
                    booking.savings_amount = fare.sellingPrice - fare.totalFare;
                    booking.savings_percentage = ((booking.savings_amount / fare.sellingPrice) * 100).toFixed(2) as any;
                }
            }

            // Map refundability
            if (orderDetails.routes?.isRefundable !== undefined) {
                booking.is_refundable = orderDetails.routes.isRefundable;
            }

            // Map location details from segments
            if (orderDetails.routes?.flightSegments && orderDetails.routes.flightSegments.length > 0) {
                const segments = orderDetails.routes.flightSegments;
                const firstSegment = segments[0];
                const lastSegment = segments[segments.length - 1];

                // Update origin details
                if (firstSegment.departure && firstSegment.departure.length > 0) {
                    const departureInfo = firstSegment.departure[0];
                    booking.origin_code = [departureInfo.code];
                    booking.origin_city = [departureInfo.city || ''];
                    booking.origin_country = [departureInfo.country || ''];
                }

                // Update destination details
                if (lastSegment.arrival && lastSegment.arrival.length > 0) {
                    const arrivalInfo = lastSegment.arrival[0];
                    booking.destination_code = [arrivalInfo.code];
                    booking.destination_city = [arrivalInfo.city || ''];
                    booking.destination_country = [arrivalInfo.country || ''];
                }
            }
        }

        // Set module type for flight (assuming 1 is flight module ID)
        booking.module_type = 1; // Flight module

        // Set booking from web/mobile
        booking.booking_from = BookingFrom.WEB; // You can pass this from request if needed

        // Set verification status
        booking.is_verified = false; // Will be verified after payment

        // Update timestamp
        booking.updated_at = new Date();

        // Save booking first
        const savedBooking = await this.save(booking);

        // Create booking additional details with must-have data
        if (apiRequest && supplierResponse) {
            try {
                // Store separate data for supplier and API responses
                await this.createBookingAdditionalDetail({
                    bookingId,
                    bookingReferenceId: savedBooking.booking_reference_id,
                    supplierResponse, // Raw supplier response (from TBO/provider API)
                    apiRequest, // Client's booking request
                    apiResponse: supplierDetails, // Processed BookResponse (what we return to client)
                    orderDetails,
                    bookingItem,
                });
            } catch (error) {
                console.error('Error creating booking additional details:', error);
                // Don't throw error here - booking is already saved
                // Log it for monitoring but don't break the booking flow
            }
        }

        return savedBooking;
    }

    /** [@Description: This method is used to extract the passport data from the passengers]
     * Helper method: Extract passport data from passengers
     * Formats passport information for storage in additional details
     * @author: Prashant Joshi at 13-10-2025 **/
    private extractPassportData(passengers: Passenger[]): any {
        const passengersWithPassport = passengers.filter((p) => p.document);

        if (passengersWithPassport.length === 0) {
            return null;
        }

        return {
            passengers: passengersWithPassport.map((p) => ({
                passengerName: `${p.passengerDetail.firstName} ${p.passengerDetail.lastName}`,
                passengerType: p.passengerType,
                documentType: p.document?.documentType,
                documentNumber: p.document?.documentNumber,
                documentExpiryDate: p.document?.expiryDate,
                passportIssuingCountry: p.document?.country,
                nationality: p.nationality,
            })),
        };
    }

    /** [@Description: This method is used to extract the cancellation policy from the fare rules]
     * Helper method: Extract and format cancellation policy from fare rules
     * Converts fare rules into readable cancellation policy text
     * @author: Prashant Joshi at 13-10-2025 **/
    private extractCancellationPolicy(fareRules?: FareRules[]): string | null {
        if (!fareRules || fareRules.length === 0) {
            return null;
        }

        const policyText = fareRules
            .map((rule) => {
                const sections: string[] = [];

                if (rule.origin) {
                    sections.push(`Origin: ${rule.origin}`);
                }
                if (rule.Destination) {
                    sections.push(`Destination: ${rule.Destination}`);
                }
                if (rule.Airline) {
                    sections.push(`Airline: ${rule.Airline}`);
                }
                if (rule.FlightNumber) {
                    sections.push(`Flight Number: ${rule.FlightNumber}`);
                }
                if (rule.DepartureDate) {
                    sections.push(`Departure Date: ${rule.DepartureDate}`);
                }
                if (rule.FareBasisCode) {
                    sections.push(`Fare Basis Code: ${rule.FareBasisCode}`);
                }
                if (rule.FareRestriction) {
                    sections.push(`Fare Restriction: ${rule.FareRestriction}`);
                }
                if (rule.FareRuleDetail) {
                    sections.push(`\nFare Rule Details:\n${rule.FareRuleDetail}`);
                }

                return sections.join('\n');
            })
            .join('\n\n---\n\n');

        return policyText;
    }

    /** [@Description: This method is used to create the booking additional detail]
     * Create booking additional details entry
     * Stores supplier and API request/response data separately for audit trail
     * @author: Prashant Joshi at 13-10-2025 **/
    async createBookingAdditionalDetail(reqParams): Promise<BookingAdditionalDetail> {
        const { bookingId, bookingReferenceId, supplierResponse, apiRequest, apiResponse, orderDetails, bookingItem = 1 } = reqParams;
        const additionalDetail = new BookingAdditionalDetail();

        // Required fields
        additionalDetail.booking_id = bookingId;
        additionalDetail.booking_reference_id = bookingReferenceId;
        additionalDetail.booking_item = bookingItem;

        // Set booking type
        additionalDetail.add_booking_type = AddBookingType.DEFAULT_BOOKING;

        // 1. Supplier Response: Store ONLY raw supplier response (from TBO, Amadeus, etc.)
        //    This is the actual response received from the provider's API
        additionalDetail.supplier_response = supplierResponse;

        // 2. API Response: Store ONLY our API request/response
        //    Request: What client sent to our API
        //    Response: What our API returned to client (processed BookResponse)
        //    Do not store raw supplier response
        delete apiResponse.rawSupplierResponse;
        additionalDetail.api_response = {
            request: apiRequest, // Client's booking request to our API
            response: apiResponse, // Our processed response returned to client
        };

        // 3. Store cancellation policy from fare rules
        if (orderDetails?.routes?.fareRules) {
            const cancellationPolicy = this.extractCancellationPolicy(orderDetails.routes.fareRules);
            if (cancellationPolicy) {
                additionalDetail.terms_cancellation_policy = cancellationPolicy;
            }
        }

        // 4. Store passport data for international flights
        if (apiRequest.passengers && apiRequest.passengers.length > 0) {
            const passportData = this.extractPassportData(apiRequest.passengers);
            if (passportData) {
                additionalDetail.passport_document_data = passportData;
            }
        }

        // Set timestamps
        additionalDetail.created_at = new Date();
        additionalDetail.updated_at = new Date();

        // Save and return
        return this.dataSource.getRepository(BookingAdditionalDetail).save(additionalDetail);
    }

    /** [@Description: This method is used to verify the booking log]
     * @author: Prashant Joshi at 13-10-2025 **/
    async verifyBookingLog(reqParams): Promise<BookingLog> {
        const { bookingLogId } = reqParams;
        // Validate bookingLogId
        if (!bookingLogId) {
            throw new Error('Booking log ID is required');
        }

        const bookingLog = await this.dataSource.getRepository(BookingLog).findOne({ where: { log_id: bookingLogId } });
        if (!bookingLog) {
            throw new Error(`Booking log not found with ID: ${bookingLogId}`);
        }
        bookingLog.is_verified = true;
        bookingLog.payment_status = PaymentStatus.CAPTURED;
        bookingLog.transaction_id = uuidv4();
        bookingLog.updated_at = new Date();
        return this.dataSource.getRepository(BookingLog).save(bookingLog);
    }
}
