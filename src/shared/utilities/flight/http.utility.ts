import Axios from 'axios';

export class Http {
    /** [@Description: For Mystifly API]
     * @author: Prashant Joshi at 23-09-2025 **/
    static async httpRequestMY(method: string, data, endpoint: string, sessionId: string) {
        try {
            let result;
            if (data == '') {
                result = await Axios({
                    method: method,
                    url: endpoint,
                    headers: {
                        Authorization: `Bearer ${sessionId}`,
                        'Content-Type': 'application/json',
                    },
                });
            } else {
                result = await Axios({
                    method: method,
                    url: endpoint,
                    headers: {
                        Authorization: `Bearer ${sessionId}`,
                        'Content-Type': 'application/json',
                    },
                    data: data,
                });
            }
            return result.data;
        } catch (error) {
            console.log(error);
            return [];
        }
    }

    /** [@Description: For PKfare API]
     * @author: Prashant Joshi at 23-09-2025 **/
    static async httpRequestPK(method: string, endpoint: string, apiType = '') {
        try {
            const result = await Axios({
                method: method,
                url: endpoint,
                headers: {
                    'Content-Type': 'text/xml',
                },
                responseType: apiType != '' ? 'arraybuffer' : 'text',
            });

            return result.data;
        } catch (error) {
            return false;
        }
    }

    /** [@Description: For PKfare JSON API]
     * @author: Prashant Joshi at 23-09-2025 **/
    static async httpRequestPKJson(method: string, endpoint: string, data) {
        try {
            const result = await Axios({
                method: method,
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: JSON.stringify(data),
            });

            return result.data;
        } catch (error) {
            return false;
        }
    }

    /** [@Description: For Qunar API]
     * @author: Prashant Joshi at 23-09-2025 **/
    static async httpRequestQN(method: string, endpoint: string) {
        try {
            const result = await Axios({
                method: method,
                url: endpoint,
                headers: {
                    'Content-Type': 'text/xml',
                },
                responseType: 'text',
            });

            return result.data;
        } catch (error) {
            return [];
        }
    }

    static async httpRequestTBO(method: string, endpoint: string, data) {
        try {
            const result = await Axios({
                method: method,
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: data,
            });
            return result.data;
        } catch (error) {
            if (error.response) {
                // The request was made, but the server responded with an error
                console.error('Server responded with error status:', error.response.status);
                console.error('Response data:', error.response.data);
            } else if (error.request) {
                // The request was made, but no response was received
                console.error('No response received from the server');
            } else {
                // Something happened in setting up the request that triggered an Error
                console.error('Error setting up the request:', error.message);
            }
            return [];
        }
    }

    /** [@Description: For TBO Hotel API with authentication]
     * @author: Prashant - TBO Hotel Integration **/
    static async httpRequestTBOHotel(method: string, endpoint: string, data, auth: { username: string; password: string }) {
        try {
            const result = await Axios({
                method: method,
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                auth: {
                    username: auth.username,
                    password: auth.password,
                },
                data: data,
                timeout: 60000,
            });
            return result.data;
        } catch (error) {
            if (error.response) {
                // The request was made, but the server responded with an error
                console.error('TBO Hotel API Error - Status:', error.response.status);
                console.error('TBO Hotel API Error - Response:', error.response.data);
            } else if (error.request) {
                // The request was made, but no response was received
                console.error('TBO Hotel API - No response received');
            } else {
                // Something happened in setting up the request that triggered an Error
                console.error('TBO Hotel API Setup Error:', error.message);
            }
            throw error; // Re-throw for proper error handling
        }
    }
}
