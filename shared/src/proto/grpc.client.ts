import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const env = (key: string, fallback: string) => process.env[key] ?? fallback;

const PROTO_PATH = path.join(__dirname, 'auth.proto');
const AUTH_GRPC_ADDRESS = env('AUTH_GRPC_ADDRESS', '127.0.0.1:50051');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});

const authProto = grpc.loadPackageDefinition(packageDef).auth as any;

/**
 * Singleton gRPC client for Auth Service.
 * Import this in any service that needs to validate tokens or
 * call register/login/refresh — no need to configure the channel
 * per-service.
 *
 * Usage:
 *   import { authGrpcClient } from '@aerolink/shared/grpc';
 *   authGrpcClient.ValidateToken({ token }, (err, response) => { ... });
 */
export const authGrpcClient = new authProto.AuthService(
    AUTH_GRPC_ADDRESS,
    grpc.credentials.createInsecure(),
);