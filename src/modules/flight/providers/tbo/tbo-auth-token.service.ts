import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigurationService } from '../../configuration/configuration.service';
import { s3BucketService } from 'src/shared/utilities/flight/s3bucket.utility';
import { Http } from 'src/shared/utilities/flight/http.utility';
import { SupplierLogUtility } from 'src/shared/utilities/flight/supplier-log.utility';

@Injectable()
export class TboAuthTokenService {
    constructor(
        private readonly configurationService: ConfigurationService,
        private readonly s3BucketService: s3BucketService,
        private readonly supplierLogUtility: SupplierLogUtility,
    ) {}

    /** [@Description: This method is used to get the auth token]
     * @author: Prashant Joshi at 13-10-2025 **/
    async getAuthToken(searchRequest) {
        try {
            const authToken = await this.configurationService.getToken({ searchRequest, module: 'Flight' });
            if (authToken == 'undefined' || authToken == null || authToken == '') {
                const newAuthToken = await this.getNewAuthToken(searchRequest);
                await this.configurationService.updateAuthToken({ newAuthToken, searchRequest, module: 'Flight' });
                return newAuthToken;
            }
            // Save auth logs to S3
            const logs = {
                request: searchRequest,
                response: authToken,
            };
            // await this.s3BucketService.generateS3LogFile((searchRequest?.searchReqID || 'unknown') + '-' + new Date().toISOString().slice(0, 10) + '-auth-TBO', logs, 'auth');
            await this.supplierLogUtility.generateLogFile({
                fileName: (searchRequest?.searchReqID || 'unknown') + '-' + new Date().toISOString().slice(0, 10) + '-auth-TBO',
                logData: logs,
                folderName: 'auth',
                logId: null,
                title: 'Auth-TBO',
                searchReqId: searchRequest?.searchReqID,
                bookingReferenceId: null,
            });
            return authToken;
        } catch (error) {
            console.log(error);
            throw new InternalServerErrorException('There is an issue while fetching data from the providers.');
        }
    }

    /** [@Description: This method is used to get the new auth token]
     * @author: Prashant Joshi at 13-10-2025 **/
    async getNewAuthToken(searchRequest) {
        const { providerCred, headers } = searchRequest;
        try {
            const data = {
                ClientId: providerCred.client_id,
                UserName: providerCred.username,
                Password: providerCred.password,
                EndUserIp: headers['ip-address'],
            };
            // const endpoint = `${providerCred.url}SharedServices/SharedData.svc/rest/Authenticate`;
            const endpoint = `${providerCred.auth_url}/SharedData.svc/rest/Authenticate`;
            const sessionData = await Http.httpRequestTBO('POST', endpoint, JSON.stringify(data));
            const logs = {
                request: data,
                response: sessionData,
                ApiRequest: searchRequest,
                ApiResponse: sessionData,
            };
            // Log auth request to S3
            // await this.s3BucketService.generateS3LogFile((searchRequest?.searchReqID || 'unknown') + '-' + new Date().toISOString().slice(0, 10) + '-auth-request-TBO', logs, 'auth');
            await this.supplierLogUtility.generateLogFile({
                fileName: (searchRequest?.searchReqID || 'unknown') + '-' + new Date().toISOString().slice(0, 10) + '-auth-request-TBO',
                logData: logs,
                folderName: 'auth',
                logId: null,
                title: 'Auth-TBO',
                searchReqId: searchRequest?.searchReqID,
                bookingReferenceId: null,
            });
            if (sessionData.Status == 1 && sessionData.TokenId != '') {
                return sessionData.TokenId;
            } else {
                throw new InternalServerErrorException('There is an issue while fetching data from the providers.');
            }
        } catch (error) {
            console.log(error);
            throw new InternalServerErrorException('There is an issue while fetching data from the providers.');
        }
    }
}
