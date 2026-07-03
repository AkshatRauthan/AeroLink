import CustomError from "./customError.class";

export class SeatUnavailableError extends CustomError {
    constructor(seatNo: string) {
        super(`Seat ${seatNo} is no longer available`, 409, 'SEAT_UNAVAILABLE');
    }
}

export class IdempotencyConflictError extends CustomError {
    constructor(idempotencyKey: string) {
        super(`Request with idempotency key ${idempotencyKey} already processed`, 409, 'IDEMPOTENCY_CONFLICT');
    }
}

export class BookingExpiredError extends CustomError {
    constructor(bookingId: string) {
        super(`Booking ${bookingId} has expired`, 410, 'BOOKING_EXPIRED');
    }
}

export class ShardNotFoundError extends CustomError {
    constructor(shardIndex: number) {
        super(`No connection pool found for shard index ${shardIndex}`, 500, 'SHARD_NOT_FOUND', false);
    }
}

export class UnauthorizedError extends CustomError {
    constructor(message = 'Unauthorized') {
        super(message, 401, 'UNAUTHORIZED');
    }
}

export class RateLimitExceededError extends CustomError {
    constructor() {
        super('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED');
    }
}

export class PaymentFailedError extends CustomError {
    constructor(reason: string) {
        super(`Payment failed: ${reason}`, 402, 'PAYMENT_FAILED');
    }
}

export class ValidationError extends CustomError {
    constructor(message: string) {
        super(message, 400, 'VALIDATION_ERROR');
    }
}

export class NotFoundError extends CustomError {
    constructor(resource: string) {
        super(`${resource} not found`, 404, 'NOT_FOUND');
    }
}