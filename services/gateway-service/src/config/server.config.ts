import { getPort, getEnv } from '@aerolink/shared';

interface IServerConfig {
    PORT: number,
    CORS_ORIGINS: string;
    SERVICE_NAME: string;

    AUTH_SERVICE: string;
    FLIGHT_SERVICE: string;
    BOOKING_SERVICE: string;
    PAYMENT_SERVICE: string;
    GATEWAY_SERVICE: string;
    NOTIFICATION_SERVICE: string;
}

const ServerConfig: IServerConfig = {
    PORT: getPort('PORT', '7000'),
    CORS_ORIGINS: getEnv('CORS_ORIGINS', '*'),
    SERVICE_NAME: getEnv('SERVICE_NAME', 'aerolink-gateway-service'),
    
    AUTH_SERVICE: getEnv('AUTH_SERVICE'),
    FLIGHT_SERVICE: getEnv('FLIGHT_SERVICE'),
    BOOKING_SERVICE: getEnv('BOOKING_SERVICE'),
    PAYMENT_SERVICE: getEnv('PAYMENT_SERVICE'),
    GATEWAY_SERVICE: getEnv('GATEWAY_SERVICE'),
    NOTIFICATION_SERVICE: getEnv('NOTIFICATION_SERVICE'),
}

export default ServerConfig;