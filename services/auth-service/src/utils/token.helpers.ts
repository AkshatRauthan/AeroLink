import { createHash, randomBytes } from 'crypto';

const REFRESH_TOKEN_BYTES = 64;

/**
 * Generates a cryptographically random raw refresh token. This is the
 * actual secret value sent to the client — never stored directly, only
 * its hash (see hashToken) is persisted in refresh_tokens.token_hash.
 */
export const generateRawToken = (): string => {
    return randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
};

/**
 * Hashes a raw refresh token for storage/comparison. Refresh tokens are
 * long, high-entropy random values (not human-guessable like passwords),
 * so a fast cryptographic hash (SHA-256) is sufficient here — no need for
 * argon2's deliberate slowness, which is specifically for defending against
 * brute-forcing low-entropy human passwords.
 */
export const hashToken = (rawToken: string): string => {
    return createHash('sha256').update(rawToken).digest('hex');
};