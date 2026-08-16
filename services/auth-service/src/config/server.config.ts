import { getPort, getEnv, getPositiveInteger } from '@aerolink/shared';

interface IServerConfig {
    PORT: number,
    CORS_ORIGINS: string;
    SERVICE_NAME: string;

    JWT_ACCESS_SECRET: string;
    JWT_ACCESS_EXPIRY: number;
    REFRESH_TOKEN_SECRET: string;
    REFRESH_TOKEN_EXPIRY: number;

}

const ServerConfig: IServerConfig = {
    PORT: getPort('PORT', '7000'),
    CORS_ORIGINS: getEnv('CORS_ORIGINS', '*'),
    SERVICE_NAME: getEnv('SERVICE_NAME', 'aerolink-auth-service'),

    JWT_ACCESS_SECRET: getEnv('JWT_ACCESS_SECRET'),
    JWT_ACCESS_EXPIRY: getPositiveInteger('JWT_ACCESS_EXPIRY', '900'),
    REFRESH_TOKEN_SECRET: getEnv('REFRESH_TOKEN_SECRET'),
    REFRESH_TOKEN_EXPIRY: getPositiveInteger('JWT_ACCESS_EXPIRY', '604800'),
}

export default ServerConfig;