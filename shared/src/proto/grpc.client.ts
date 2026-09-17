import * as grpc from '@grpc/grpc-js';
import {
    AuthServiceClient,
    ValidateTokenResponse,
    GetUserResponse,
} from '../proto/generated/auth';

const env = (key: string, fallback: string) => process.env[key] ?? fallback;

const AUTH_GRPC_ADDRESS = env('AUTH_GRPC_ADDRESS', '127.0.0.1:50051');

/**
 * Singleton gRPC client for Auth Service. Import this in any service
 * that needs to validate tokens or fetch user details — no need to
 * configure the channel per-service. Fully typed against the generated
 * message/service definitions — no protoLoader, no `any` casts.
 */
const authGrpcClient = new AuthServiceClient(
    AUTH_GRPC_ADDRESS,
    grpc.credentials.createInsecure(),
);


/**
 * Promisified ValidateToken call. Rejects with a gRPC ServiceError on
 * UNAUTHENTICATED (invalid/expired/blacklisted token) — check
 * `error.metadata.get('reason')` for EXPIRED/REVOKED/INVALID, or
 * catch and map to your own error format.
 */
export const validateToken = (token: string): Promise<ValidateTokenResponse> => {
    return new Promise((resolve, reject) => {
        authGrpcClient.validateToken({ token }, (err, response) => {
            if (err) return reject(err);
            resolve(response);
        });
    });
};


/**
 * Promisified GetUser call. Rejects with a gRPC ServiceError on
 * NOT_FOUND if the userId doesn't exist in Auth's DB.
 */
export const getUser = (userId: string): Promise<GetUserResponse> => {
    return new Promise((resolve, reject) => {
        authGrpcClient.getUser({ userId }, (err, response) => {
            if (err) return reject(err);
            resolve(response);
        });
    });
};