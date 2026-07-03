import amqp, { Connection, ConfirmChannel } from 'amqplib';

const env = (key: string, fallback: string) => process.env[key] ?? fallback;

const RABBITMQ_URL = env(
    'RABBITMQ_URL',
    `amqp://${env('RABBITMQ_USER', 'aerolink')}:${env('RABBITMQ_PASSWORD', 'aerolinkpass')}@${env('RABBITMQ_HOST', '127.0.0.1')}:${env('RABBITMQ_PORT', '5672')}`,
);

let connection: Connection | null = null;
let confirmChannel: ConfirmChannel | null = null;

/**
 * Returns a shared ConfirmChannel. Using a confirm channel (not a plain
 * channel) means every publish can be awaited for broker acknowledgement —
 * critical for booking.confirmed and payment events where silently losing
 * a message is unacceptable.
 */
export const getRabbitChannel = async (): Promise<ConfirmChannel> => {
    if (confirmChannel) return confirmChannel;

    connection = await amqp.connect(RABBITMQ_URL);
    connection.on('error', (err: any) => console.error('[rabbitmq] connection error:', err.message));
    connection.on('close', () => {
        console.warn('[rabbitmq] connection closed');
        confirmChannel = null;
        connection = null;
    });

    confirmChannel = await connection.createConfirmChannel();
    return confirmChannel;
};

export const closeRabbitConnection = async (): Promise<void> => {
    await confirmChannel?.close();
    await connection?.close();
    confirmChannel = null;
    connection = null;
};