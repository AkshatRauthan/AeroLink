import { Kafka, logLevel, type Producer, type Consumer } from 'kafkajs';

const env = (key: string, fallback: string) => process.env[key] ?? fallback;

const kafka = new Kafka({
    clientId: env('SERVICE_NAME', 'aerolink-service'),
    brokers: [env('KAFKA_BROKER', '127.0.0.1:9092')],
    logLevel: logLevel.WARN,
    retry: {
        initialRetryTime: 300,
        retries: 5,
    },
});

let producer: Producer | null = null;

export const getKafkaProducer = async (): Promise<Producer> => {
    if (producer) return producer;
    producer = kafka.producer();
    await producer.connect();
    return producer;
};

/**
 * Creates a consumer in its own consumer group. Each service should call
 * this with a unique, stable groupId (e.g. "flight-service-group") so
 * Kafka load-balances the topic across that service's replicas without
 * stepping on other services' independent reads of the same topic.
 */
export const createKafkaConsumer = async (groupId: string): Promise<Consumer> => {
    const consumer = kafka.consumer({ groupId });
    await consumer.connect();
    return consumer;
};

export const disconnectKafka = async (): Promise<void> => {
    await producer?.disconnect();
    producer = null;
};