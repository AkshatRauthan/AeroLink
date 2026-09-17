import * as grpc from '@grpc/grpc-js';
import { StatusCodes } from 'http-status-codes';
import { AuthProto } from '@aerolink/shared/proto';
import { Logger, CustomError } from '@aerolink/shared';

import { TokenService } from '@root/modules/token';
import { AuthService } from '@root/modules/auth';


/**
 * ValidateToken handler — called by Gateway on every authenticated
 * request. Decodes the JWT, checks the sessionId blacklist (inside
 * verifyAccessToken), and returns the token payload.
 *
 * verifyAccessToken now throws three distinct CustomError(401) messages
 * — 'Access token has expired', 'Invalid access token', 'Access token
 * has been revoked' — rather than one generic message. All three still
 * map to the gRPC UNAUTHENTICATED status (none of them are server
 * errors), but the specific message is preserved so Gateway/logs can
 * act differently per reason if needed — e.g. an expired token might
 * warrant a silent client-side refresh attempt, where a blacklisted one
 * should not.
 *
 * Anything that ISN'T a CustomError (e.g. Redis unreachable mid
 * blacklist-check, an unexpected bug) is a genuine server-side failure,
 * not a bad token, and must NOT be reported as UNAUTHENTICATED — that
 * would tell Gateway "this user is invalid" when the real problem is
 * Auth's own infra, incorrectly rejecting legitimate users during e.g.
 * a cache outage. Those map to INTERNAL instead, same distinction
 * getUserHandler makes below.
 */
export const validateTokenHandler: grpc.handleUnaryCall<AuthProto.ValidateTokenRequest, AuthProto.ValidateTokenResponse> = async (
    call,
    callback,
) => {
    try {
        const { token } = call.request;
        const payload = await TokenService.verifyAccessToken(token);

        callback(null, {
            userId: payload.sub,
            role: payload.role,
            sessionId: payload.sessionId,
            jti: payload.jti,
        });
    } catch (error) {
        const isTokenError = error instanceof CustomError && error.errorCode === StatusCodes.UNAUTHORIZED;

        if (isTokenError) {
            const reason =
                error.message === 'Access token has expired' ? 'EXPIRED' :
                error.message === 'Access token has been revoked' ? 'REVOKED' :
                'INVALID';

            Logger.warn('gRPC ValidateToken rejected — bad token', {
                reason,
                message: error.message,
            });

            const metadata = new grpc.Metadata();
            metadata.set('reason', reason);

            callback({
                code: grpc.status.UNAUTHENTICATED,
                message: error.message,
                metadata,
            });
            return;
        }

        Logger.error('gRPC ValidateToken failed — unexpected error', {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        callback({
            code: grpc.status.INTERNAL,
            message: 'Internal server error',
        });
    }
};


/**
 * GetUser handler — called by Booking/Payment to fetch user + profile
 * details for order records and notifications. Reuses AuthService.getMe,
 * the same service function that backs the HTTP GET /me endpoint, so
 * both paths share one source of truth for "what a user's own data
 * request returns" rather than the gRPC path duplicating that logic
 * against the repository directly.
 *
 * getMe throws CustomError(NOT_FOUND) if the user doesn't exist, or
 * CustomError(INTERNAL) if the profile row is missing — both are caught
 * below and mapped to gRPC status codes rather than leaking HTTP-shaped
 * errors across the gRPC boundary.
 *
 * proto3 string fields can't carry null, so nullable profile fields
 * (middleName, address) are coerced to '' when absent — callers should
 * treat an empty string as "not set", not as a real value.
 */
export const getUserHandler: grpc.handleUnaryCall<AuthProto.GetUserRequest, AuthProto.GetUserResponse> = async (
    call,
    callback,
) => {
    try {
        const { userId } = call.request;
        const { user, profile } = await AuthService.getMe(userId);

        callback(null, {
            id: user.id,
            email: user.email,
            phoneNo: user.phoneNo,
            role: user.role,
            firstName: profile.firstName,
            middleName: profile.middleName ?? '',
            lastName: profile.lastName,
            address: profile.address ?? '',
        });
    } catch (error) {
        Logger.warn('gRPC GetUser failed', {
            message: error instanceof Error ? error.message : String(error),
        });

        const isNotFound = error instanceof CustomError && error.errorCode === StatusCodes.NOT_FOUND;
        callback({
            code: isNotFound ? grpc.status.NOT_FOUND : grpc.status.INTERNAL,
            message: error instanceof Error ? error.message : 'Internal server error',
        });
    }
};