import { z } from "zod";
import { StatusCodes } from "http-status-codes";
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Logger, CorrelationIdUtils, CustomError } from "@aerolink/shared";

import { TokenService } from "@root/modules/token";

export const LogAllReqSharedMiddleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
        Logger.info(`${req.method} ${req.originalUrl} ${res.statusCode}`, {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            latencyMs: Date.now() - start,
            userId: req.user?.userId,
            jti: req.user?.jti,
            sessionId: req.user?.sessionId,
            correlationId: CorrelationIdUtils.getRequestId(req),
        });
    });
    return next();
}


export const AuthenticateAllReqSharedMiddleware: RequestHandler = async (req: Request, _: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(
            new CustomError("Invalid request. Missing auth tokens.", StatusCodes.UNAUTHORIZED)
        );
    }

    const token = authHeader.split(" ")[1];
    if (token.trim() == "") {
        return next(
            new CustomError("Invalid request. Missing auth tokens.", StatusCodes.UNAUTHORIZED)
        );
    }

    try {
        const payload = await TokenService.verifyAccessToken(token);
        req.user = {
            jti: payload.jti,
            role: payload.role,
            userId: payload.sub,
            sessionId: payload.sessionId,
        }
    } catch (error) {
        if (error instanceof CustomError) return next(error);
        return next(
            new CustomError("Error while decoding the jwt payload.", StatusCodes.FORBIDDEN, false)
        );
    }

    return next();
}


export const ZodValidationHelper = (schema: z.ZodSchema): RequestHandler => (req, _, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        return next(new CustomError(result.error.errors[0].message, StatusCodes.BAD_REQUEST));
    }
    req.body = result.data;
    return next();
};