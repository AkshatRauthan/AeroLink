import winston from 'winston';

const env = (key: string, fallback: string) => process.env[key] ?? fallback;
const SERVICE_NAME = env('SERVICE_NAME', 'aerolink-service');
const NODE_ENV = env('NODE_ENV', 'development');
const LOG_LEVEL = env('MIN_LOG_LEVEL', 'info');

/**
 * Custom log levels extending Winston's defaults:
 *   fatal(0) > error(1) > warn(2) > info(3) > debug(4) > trace(5)
 *
 * Use:
 *   logger.fatal  — app is broken, needs immediate human intervention
 *   logger.error  — operation failed, user affected, app still running
 *   logger.warn   — unexpected but recovered, user not affected
 *   logger.info   — normal behaviour worth knowing (startup, batch complete)
 *   logger.debug  — developer detail, turn off in production
 *   logger.trace  — extremely granular, never in production
 */
const customLevels = {
    levels: {
        fatal: 0,
        error: 1,
        warn: 2,
        info: 3,
        debug: 4,
        trace: 5,
    },
    colors: {
        fatal: 'red',
        error: 'red',
        warn: 'yellow',
        info: 'green',
        debug: 'blue',
        trace: 'gray',
    },
};

winston.addColors(customLevels.colors);

// Production: pure JSON — one log line per event, easy to ingest into
// CloudWatch / Grafana / Datadog without any parsing.
const jsonFormat = winston.format.combine(
    winston.format.timestamp({ format: 'ISO' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
);

// Development: colorized, human-readable single line.
const devFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
        return `[${timestamp}] [${service}] ${level}: ${message}${metaStr}`;
    }),
);

const winstonLogger = winston.createLogger({
    levels: customLevels.levels,
    level: LOG_LEVEL,
    defaultMeta: { service: SERVICE_NAME },
    format: NODE_ENV === 'production' ? jsonFormat : devFormat,
    transports: [new winston.transports.Console()],
    exitOnError: false,
});

/**
 * Typed logger wrapper — enforces the 6-level convention across all services.
 *
 * Every log call accepts an optional `meta` object for structured context:
 *   logger.error('Failed to insert booking', { bookingId, userId, err });
 *
 * In production, this emits:
 *   {
 *     "timestamp": "2026-07-01T12:00:00.000Z",
 *     "level": "error",
 *     "service": "booking-service",
 *     "message": "Failed to insert booking",
 *     "bookingId": "...",
 *     "userId": "...",
 *     "err": { ... }
 *   }
 */
const Logger = {
    /** App completely broken — requires immediate human intervention. */
    fatal: (message: string, meta?: object) =>
        (winstonLogger as any).fatal({ message, ...meta }),

    /** Operation failed, user received an error, app still running. */
    error: (message: string, meta?: object) =>
        winstonLogger.error({ message, ...meta }),

    /** Unexpected but recovered — user not affected. */
    warn: (message: string, meta?: object) =>
        winstonLogger.warn({ message, ...meta }),

    /** Normal app behaviour worth recording. */
    info: (message: string, meta?: object) =>
        winstonLogger.info({ message, ...meta }),

    /** Developer detail — never enable in production. */
    debug: (message: string, meta?: object) =>
        winstonLogger.debug({ message, ...meta }),

    /** Extremely granular — never in production, floods disk. */
    trace: (message: string, meta?: object) =>
        (winstonLogger as any).trace({ message, ...meta }),
};

export default Logger;