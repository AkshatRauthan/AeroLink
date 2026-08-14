import { Router } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

import healthRoutes from './health';
import { ServerConfig } from "@root/config";
import { CorrelationIdUtils } from "@aerolink/shared";

const {
    AUTH_SERVICE, BOOKING_SERVICE, FLIGHT_SERVICE,
    PAYMENT_SERVICE, NOTIFICATION_SERVICE,
} = ServerConfig;

const router: Router = Router();

router.use("/health",
    healthRoutes
);

router.use(
    CorrelationIdUtils.requestIdMiddleware
);

router.use("/auth", createProxyMiddleware({
    target: AUTH_SERVICE as string,
    changeOrigin: true,
    pathRewrite: { '^/auth': '' }
}));

router.use("/bookings", createProxyMiddleware({
    target: BOOKING_SERVICE as string,
    changeOrigin: true,
    pathRewrite: { '^/bookings': '' }
}));

router.use("/flights", createProxyMiddleware({
    target: FLIGHT_SERVICE as string,
    changeOrigin: true,
    pathRewrite: { '^/flights': '' }
}));

router.use("/payments", createProxyMiddleware({
    target: PAYMENT_SERVICE as string,
    changeOrigin: true,
    pathRewrite: { '^/payments': '' }
}));

router.use("/notifications", createProxyMiddleware({
    target: NOTIFICATION_SERVICE as string,
    changeOrigin: true,
    pathRewrite: { '^/notifications': '' }
}));

export default router;