import { StatusCodes } from "http-status-codes";
import type { Request, Response, NextFunction } from "express";

import CustomError from "./customError.class";
import { Logger } from "@shared/utils";

/**
 * Centralized error handler — register this as the LAST middleware in
 * every service's Express app. Operational errors (CustomError instances)
 * return their actual message + code; anything else (unexpected bugs) is
 * masked behind a generic 500 so internals never leak to the client.
 */
export default function ErrorHandler(
    err: unknown,
    req: Request,
    res: Response,
    _: NextFunction,
): void {
    const requestId = req.headers['x-request-id'] as string | undefined;

    if (err instanceof CustomError) {
        if (!err.isOperational) {
            Logger.error(`[non-operational error] ${err.message}`, {
                requestId,
                stack: err.stack,
                message: err.message,
                errorCode: err.errorCode,
                isOperational: err.isOperational,
            });
        }

        res.status(err.errorCode).json({
            success: false,
            message: err.message,
        });
        return;
    }

    Logger.error('[unhandled error]', {
        requestId,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
    });

    res.status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({
            success: false,
            message: "Something went wrong",
        });
};