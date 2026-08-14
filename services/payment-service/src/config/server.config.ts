import { getPort, getEnv } from '@aerolink/shared';

interface IServerConfig {
    PORT: number,
    CORS_ORIGINS: string;
    SERVICE_NAME: string;
}

const ServerConfig: IServerConfig = {
    PORT: getPort('PORT', '7000'),
    CORS_ORIGINS: getEnv('CORS_ORIGINS', '*'),
    SERVICE_NAME: getEnv('SERVICE_NAME', 'aerolink-payment-service')
}

export default ServerConfig;