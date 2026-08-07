import dotenv from "dotenv";
dotenv.config();

interface IServerConfig {
    PORT: string | null,
    CORS_ORIGINS: string | null;

    AUTH_SERVICE: string | null;
    FLIGHT_SERVICE: string | null;
    BOOKING_SERVICE: string | null;
    PAYMENT_SERVICE: string | null;
    GATEWAY_SERVICE: string | null;
    NOTIFICATION_SERVICE: string | null;
}

const ServerConfig: IServerConfig = {
    PORT: process.env.PORT as string,
    CORS_ORIGINS: process.env.CORS_ORIGINS as string,
    
    AUTH_SERVICE: process.env.AUTH_SERVICE as string,
    FLIGHT_SERVICE: process.env.FLIGHT_SERVICE as string,
    BOOKING_SERVICE: process.env.BOOKING_SERVICE as string,
    PAYMENT_SERVICE: process.env.PAYMENT_SERVICE as string,
    GATEWAY_SERVICE: process.env.GATEWAY_SERVICE as string,
    NOTIFICATION_SERVICE: process.env.NOTIFICATION_SERVICE as string,
}

export default ServerConfig;