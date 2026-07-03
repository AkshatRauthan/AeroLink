import { getRabbitChannel } from "./rabbitmq.client";
import { getRetryQueueName, getDlqName, RetryConfig } from "./queue.config";

interface PublishOptions {
    headers?: Record<string, unknown>;
}

/**
 * Publishes a message and waits for broker confirmation before resolving.
 * Throws if the broker nacks the message — caller decides what to do
 * (e.g. surface a 500, or let the outer transaction roll back).
 */
export const publishToQueue = async (
    queue: string,
    message: unknown,
    options: PublishOptions = {},
): Promise<void> => {
    const channel = await getRabbitChannel();

    await channel.assertQueue(queue, { durable: true });

    const payload = Buffer.from(JSON.stringify(message));

    await new Promise<void>((resolve, reject) => {
        channel.sendToQueue(
            queue,
            payload,
            {
                persistent: true,
                headers: { 'x-retry-count': 0, ...options.headers },
            },
            (err: any) => {
                if (err) return reject(err);
                resolve();
            },
        );
    });
};

/**
 * Sets up the retry + DLQ topology for a given queue:
 *   main queue --(nack/fail)--> retry queue --(TTL expiry)--> main queue
 *   after RetryConfig.maxAttempts --> DLQ
 *
 * Call this once at service startup for every queue the service consumes.
 */
export const setupRetryTopology = async (queue: string): Promise<void> => {
    const channel = await getRabbitChannel();
    const retryQueue = getRetryQueueName(queue);
    const dlqQueue = getDlqName(queue);

    await channel.assertQueue(queue, { durable: true });
    await channel.assertQueue(dlqQueue, { durable: true });

    // Retry queue: messages sit here for a TTL, then dead-letter back to the
    // main queue automatically. TTL is set per-message (see requeueWithBackoff)
    // since exponential backoff needs a different delay per attempt.
    await channel.assertQueue(retryQueue, {
        durable: true,
        deadLetterExchange: '',
        deadLetterRoutingKey: queue,
    });
};

/**
 * Requeues a failed message into the retry queue with an exponential
 * backoff delay, or routes it to the DLQ once max attempts is exceeded.
 */
export const requeueWithBackoff = async (
    queue: string,
    message: unknown,
    attempt: number,
): Promise<void> => {
    const channel = await getRabbitChannel();

    if (attempt >= RetryConfig.maxAttempts) {
        await channel.sendToQueue(getDlqName(queue), Buffer.from(JSON.stringify(message)), {
            persistent: true,
            headers: { 'x-retry-count': attempt, 'x-failed-reason': 'max_attempts_exceeded' },
        });
        console.warn(`[rabbitmq] message moved to DLQ for ${queue} after ${attempt} attempts`);
        return;
    }

    const delayMs = RetryConfig.baseDelayMs * 2 ** (attempt - 1); // 5s, 10s, 20s, 40s...

    await channel.sendToQueue(getRetryQueueName(queue), Buffer.from(JSON.stringify(message)), {
        persistent: true,
        expiration: String(delayMs),
        headers: { 'x-retry-count': attempt },
    });
};