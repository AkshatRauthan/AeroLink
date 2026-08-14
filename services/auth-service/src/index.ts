import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import app from '@root/app';
import { ServerConfig } from "@root/config";
import { CustomError, Logger } from '@aerolink/shared';
import { connectAuthCache } from "@root/infrastructure/cache";
import { connectAuthDatabases } from "@root/infrastructure/db";

const HOST = process.env.HOST || '127.0.0.1';
const PORT: number = ServerConfig.PORT ? ServerConfig.PORT : 7860;

app.listen(PORT, HOST, () => {
    Logger.info(`Server running on http://${HOST}:${PORT}`);
    Logger.info(`Health checks: http://${HOST}:${PORT}/api/health`);
});

connectAuthDatabases().then(() => {
    Logger.info("Auth database connected successfully")
}).catch((error) => {
    Logger.error("Auth database connection failed", {
        stack: error instanceof Error ? error.stack : undefined,
        message: error instanceof Error ? error.message : String(error),
        errorCode: error instanceof CustomError ? error.errorCode : 500,
        isOperational: error instanceof CustomError ? error.isOperational : false,
    })
});

connectAuthCache().then(() => {
    Logger.info("Auth cache connected successfully")
}).catch((error) => {
    Logger.error("Auth cache connection failed", {
        stack: error instanceof Error ? error.stack : undefined,
        message: error instanceof Error ? error.message : String(error),
        errorCode: error instanceof CustomError ? error.errorCode : 500,
        isOperational: error instanceof CustomError ? error.isOperational : false,
    })
});