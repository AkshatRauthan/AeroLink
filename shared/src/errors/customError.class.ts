/**
 * Base class for all expected/handled errors across services.
 *
 * isOperational distinguishes errors we anticipated (bad input, business
 * rule violation, conflict) from unexpected bugs/crashes — the error
 * handler middleware uses this to decide whether to return the message
 * to the client or hide it behind a generic 500.
 */
export default class CustomError extends Error {
    public readonly statusCode: number;
    public readonly errorCode: string;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number, errorCode: string, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.isOperational = isOperational;

        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}