/**
 * Single source of truth for every RabbitMQ queue/exchange name.
 * Same pattern as CacheKeys — add one line here per new event type.
 */
export const Queues = {
    bookingConfirmed: 'booking.confirmed',
    bookingCancelled: 'booking.cancelled',
};

// Every primary queue gets a matching retry and dead-letter queue.
// Naming convention: <queue>.retry, <queue>.dlq
export const getRetryQueueName = (queue: string) => `${queue}.retry`;
export const getDlqName = (queue: string) => `${queue}.dlq`;

export const RetryConfig = {
    maxAttempts: 5,
    baseDelayMs: 5000, // first retry after 5s, then 10s, 20s, 40s, 80s (exponential)
};