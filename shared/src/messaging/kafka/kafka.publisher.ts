import { getKafkaProducer } from './kafka.client';

/**
 * Publishes a message to a Kafka topic. Unlike RabbitMQ's per-message
 * confirm, Kafka acks are handled by the producer's internal batching —
 * awaiting send() here is sufficient for our throughput needs.
 */
export const publishToTopic = async (
    topic: string,
    message: unknown,
    key?: string,
): Promise<void> => {
    const producer = await getKafkaProducer();

    await producer.send({
        topic,
        messages: [
            {
                key, // e.g. flight_id — ensures all events for the same flight land on the same partition, preserving order
                value: JSON.stringify(message),
            },
        ],
    });
};