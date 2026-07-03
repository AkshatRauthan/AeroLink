import type { ConsumeMessage } from 'amqplib';
import { getRabbitChannel } from './rabbitmq.client';
import { setupRetryTopology, requeueWithBackoff } from './queue.publisher';

type Handler = (message: unknown) => Promise<void>;

/**
 * Consumes from `queue`. On handler failure, automatically requeues with
 * exponential backoff (via the retry queue) up to RetryConfig.maxAttempts,
 * then routes to the DLQ.
 *
 * Usage:
 *   await consumeQueue(Queues.bookingConfirmed, async (msg) => {
 *     await sendConfirmationEmail(msg);
 *   });
 */
export const consumeQueue = async (queue: string, handler: Handler): Promise<void> => {
    await setupRetryTopology(queue);

    const channel = await getRabbitChannel();
    await channel.prefetch(10); // limit unacked messages per consumer

    await channel.consume(queue, async (msg: ConsumeMessage | null) => {
        if (!msg) return;

        const attempt = Number(msg.properties.headers?.['x-retry-count'] ?? 0) + 1;

        try {
            const payload = JSON.parse(msg.content.toString());
            await handler(payload);
            channel.ack(msg);
        } catch (err) {
            console.error(`[rabbitmq] handler failed for ${queue}, attempt ${attempt}:`, err);
            channel.ack(msg); // ack the original — we're explicitly requeueing via retry queue
            const payload = JSON.parse(msg.content.toString());
            await requeueWithBackoff(queue, payload, attempt);
        }
    });

    console.log(`[rabbitmq] consuming ${queue}`);
};