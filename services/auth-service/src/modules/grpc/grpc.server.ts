import * as grpc from '@grpc/grpc-js';
import { Logger } from '@aerolink/shared';
import { ServerConfig } from '@root/config';
import { AuthProto } from '@aerolink/shared/proto';

import { validateTokenHandler, getUserHandler } from './grpc.handlers';

const server = new grpc.Server();

// NOTE: the generated AuthServiceServer interface uses camelCase keys
// (validateToken, getUser) matching AuthServiceService's own keys — NOT
// the PascalCase RPC names (ValidateToken/GetUser) used internally in
// the wire path string. Registering under the wrong case here fails
// silently at the type level with protoLoader's `any`-typed approach,
// but with generated types it's caught at compile time instead.
const authServiceImpl: AuthProto.AuthServiceServer = {
    validateToken: validateTokenHandler,
    getUser: getUserHandler,
};

server.addService( AuthProto.AuthServiceService, authServiceImpl);


/**
 * Starts the gRPC server on the configured port. Call once during
 * service startup alongside connectAuthDatabases() and connectAuthCache(),
 * before accepting HTTP traffic — the gRPC server needs to be ready
 * before Gateway starts routing authenticated requests to it.
 */
export const startGrpcServer = (): Promise<void> => {
    const address = `0.0.0.0:${ServerConfig.GRPC_PORT}`;

    return new Promise((resolve, reject) => {
        server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, port) => {
            if (err) return reject(err);
            Logger.info(`Auth gRPC server listening on port ${port}`);
            resolve();
        });
    });
};


/**
 * Gracefully shuts down the gRPC server — drains in-flight calls
 * before closing. Call during process SIGTERM/SIGINT handling.
 */
export const stopGrpcServer = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        server.tryShutdown((err) => {
            if (err) return reject(err);
            Logger.info('Auth gRPC server shut down cleanly');
            resolve();
        });
    });
};