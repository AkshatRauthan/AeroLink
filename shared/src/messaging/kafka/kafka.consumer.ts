import { Logger } from "@shared/utils";
import { createKafkaConsumer } from './kafka.client';

type Handler = (message: unknown, key: string | null) => Promise<void>;

/**
 * Subscribes to `topic` under the given consumer group and processes
 * each message through `handler`. Kafka retains messages regardless of
 * consumption (unlike RabbitMQ), so a crashed consumer simply resumes
 * from its last committed offset on restart — no manual retry/DLQ
 * plumbing needed here the way RabbitMQ requires.
 *
 * Usage:
 *   await consumeTopic(Topics.flightDataGenerated, 'flight-service-group', async (msg) => {
 *     await flightRepository.upsertFlight(msg);
 *   });
 */
export const consumeTopic = async (
    topic: string,
    groupId: string,
    handler: Handler,
): Promise<void> => {
    const consumer = await createKafkaConsumer(groupId);
    
    await consumer.subscribe({ topic, fromBeginning: false });
    await consumer.run({
        eachMessage: async ({ topic: msgTopic, partition, message }) => {
            try {
                const payload = message.value ? JSON.parse(message.value.toString()) : null;
                const key = message.key ? message.key.toString() : null;
                await handler(payload, key);
            } catch (err) {
                // Kafka has no native DLQ — a poison message will block this
                // partition unless handled. Log loudly; consider a manual
                // dead-letter topic later if this becomes a real problem.
                Logger.error(`[kafka] handler failed for topic ${topic}`, {
                    topic,
                    partition,
                    offset: message.offset,
                    message: err instanceof Error ? err.message : String(err),
                    stack: err instanceof Error ? err.stack : undefined,
                });
            }
        },
    });

    Logger.info(`[kafka] consuming ${topic}`, { topic, groupId });
};