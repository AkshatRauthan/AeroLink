import { CookieOptions } from 'express';
import ServerConfig from "./server.config";

const isProd = (ServerConfig.NODE_ENV === 'production');

// REFRESH_TOKEN_EXPIRY is in seconds, converting it into milliseconds.

export const CookieConfig = {
    refreshToken: {
        httpOnly: true,
        secure: isProd,
        sameSite: 'strict',
        maxAge: ServerConfig.REFRESH_TOKEN_EXPIRY * 1000,
        path: '/',
    } as CookieOptions,
};