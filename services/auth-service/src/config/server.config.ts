import { getPort, getEnv } from '@aerolink/shared';

interface IServerConfig {
    PORT: number,
    CORS_ORIGINS: string;
}

const ServerConfig: IServerConfig = {
    PORT: getPort('PORT', '7000'),
    CORS_ORIGINS: getEnv('CORS_ORIGINS', '*'),
}

export default ServerConfig;