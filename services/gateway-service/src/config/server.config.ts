import dotenv from "dotenv";
dotenv.config();

interface IServerConfig {
    AUTH_SERVICE_PORT: string | null;
    FLIGHT_SERVICE_PORT: string | null;
    BOOKING_SERVICE_PORT: string | null;
    PAYMENT_SERVICE_PORT: string | null;
    GATEWAY_SERVICE_PORT: string | null;
    NOTIFICATION_SERVICE_PORT: string | null;
}

const ServerConfig: IServerConfig = {
    AUTH_SERVICE_PORT: process.env.AUTH_SERVICE_PORT as string,
    FLIGHT_SERVICE_PORT: process.env.FLIGHT_SERVICE_PORT as string,
    BOOKING_SERVICE_PORT: process.env.BOOKING_SERVICE_PORT as string,
    PAYMENT_SERVICE_PORT: process.env.PAYMENT_SERVICE_PORT as string,
    GATEWAY_SERVICE_PORT: process.env.GATEWAY_SERVICE_PORT as string,
    NOTIFICATION_SERVICE_PORT: process.env.NOTIFICATION_SERVICE_PORT as string,
}

export default ServerConfig;