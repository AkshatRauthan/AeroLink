import { getPort, getEnv, getPositiveInteger } from '@aerolink/shared';

interface IServerConfig {
    PORT: number,
    NODE_ENV: string;
    GRPC_PORT: number,
    CORS_ORIGINS: string;
    SERVICE_NAME: string;

    JWT_ACCESS_SECRET: string;
    JWT_ACCESS_EXPIRY: number;
    REFRESH_TOKEN_SECRET: string;
    REFRESH_TOKEN_EXPIRY: number;
    MAX_CONCURRENT_SESSIONS_PER_USER: number;
}

const ServerConfig: IServerConfig = {
    PORT: getPort('PORT', '7001'),
    GRPC_PORT: getPort('GRPC_PORT', '6001'),
    CORS_ORIGINS: getEnv('CORS_ORIGINS', '*'),
    NODE_ENV: getEnv('NODE_ENV', 'development'),
    SERVICE_NAME: getEnv('SERVICE_NAME', 'aerolink-auth-service'),

    JWT_ACCESS_SECRET: getEnv('JWT_ACCESS_SECRET'),
    JWT_ACCESS_EXPIRY: getPositiveInteger('JWT_ACCESS_EXPIRY', '900'),
    REFRESH_TOKEN_SECRET: getEnv('REFRESH_TOKEN_SECRET'),
    REFRESH_TOKEN_EXPIRY: getPositiveInteger('REFRESH_TOKEN_EXPIRY', '604800'),
    MAX_CONCURRENT_SESSIONS_PER_USER: getPositiveInteger('MAX_CONCURRENT_SESSIONS_PER_USER', '5'),
}

export default ServerConfig;