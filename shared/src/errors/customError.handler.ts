import type { Request, Response, NextFunction } from "express";
import CustomError from "./customError.class";

interface ErrorResponseBody {
    success: false;
    errorCode: string;
    message: string;
    requestId?: string;
}

/**
 * Centralized error handler — register this as the LAST middleware in
 * every service's Express app. Operational errors (CustomError instances)
 * return their actual message + code; anything else (unexpected bugs) is
 * masked behind a generic 500 so internals never leak to the client.
 */
export const errorHandler = (
    err: unknown,
    req: Request,
    res: Response,
    _: NextFunction,
): void => {
    const requestId = req.headers['x-request-id'] as string | undefined;

    if (err instanceof CustomError) {
        if (!err.isOperational) {
            console.error(`[non-operational error] ${err.errorCode}:`, err);
        }

        const body: ErrorResponseBody = {
            success: false,
            errorCode: err.errorCode,
            message: err.message,
            requestId,
        };
        res.status(err.statusCode).json(body);
        return;
    }

    console.error('[unhandled error]', err);

    const body: ErrorResponseBody = {
        success: false,
        errorCode: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong',
        requestId,
    };
    res.status(500).json(body);
};