import { CustomError } from "@shared/errors";
import { StatusCodes } from "http-status-codes";

/**
 * Shared environment-variable parsing helpers. Every service's config layer
 * (db.config.ts, cache.config.ts, messaging.config.ts, ...) should go
 * through these instead of reimplementing env parsing/validation per file.
 *
 * Philosophy: fail loud at startup on missing *required* values (no silent
 * fallback to a guessable default for anything credential-shaped), while
 * still allowing an explicit fallback for genuinely optional values.
 */

/**
 * Reads a required string env var. Throws if unset or empty, unless a
 * fallback is provided. Do NOT pass a fallback for credentials (passwords,
 * secrets, API keys) — a missing credential should fail startup, not
 * silently connect using a hardcoded default.
 */
export const getEnv = (key: string, fallback?: string): string => {
    const value = process.env[key] ?? fallback;
    if (value === undefined || value.trim() === '') {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
};

/** Reads and validates a TCP port (1-65535). */
export const getPort = (key: string, fallback?: string): number => {
    const value = Number(getEnv(key, fallback));
    if (!Number.isInteger(value) || value < 1 || value > 65535) {
        throw new CustomError(`Environment variable ${key} must be a valid port number.`, StatusCodes.BAD_REQUEST, true);
    }
    return value;
};

/** Reads and validates a positive integer (e.g. shard count, pool size). */
export const getPositiveInteger = (key: string, fallback: string): number => {
    const value = Number(getEnv(key, fallback));
    if (!Number.isInteger(value) || value < 1) {
        throw new CustomError(`Environment variable ${key} must be a positive integer.`, StatusCodes.BAD_REQUEST, true);
    }
    return value;
};

/** Reads a boolean env var. Only accepts the literal strings "true"/"false". */
export const getBoolean = (key: string, fallback: boolean): boolean => {
    const value = process.env[key];
    if (value === undefined || value.trim() === '') return fallback;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new CustomError(`Environment variable ${key} must be either "true" or "false".`, StatusCodes.BAD_REQUEST, true);
};

export const getRequired = (key: string, fallback?: string): string => {
    const value = process.env[key] ?? fallback;
    if (!value?.trim()) throw new CustomError(`Missing required environment variable: ${key}`, StatusCodes.NOT_FOUND, true);
    return value;
};