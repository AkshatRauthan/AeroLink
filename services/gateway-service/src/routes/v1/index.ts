import { Router } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

import { ServerConfig } from "@root/config";
import { CorrelationIdUtils } from "@shared/utils";

const {
    AUTH_SERVICE, BOOKING_SERVICE, FLIGHT_SERVICE,
    PAYMENT_SERVICE, NOTIFICATION_SERVICE,
} = ServerConfig;

const router: Router = Router();

router.use(
    CorrelationIdUtils.requestIdMiddleware
);

router.use("/auth", createProxyMiddleware({
    target: AUTH_SERVICE as string,
    changeOrigin: true
}));

router.use("/bookings", createProxyMiddleware({
    target: BOOKING_SERVICE as string,
    changeOrigin: true
}));

router.use("/flights", createProxyMiddleware({
    target: FLIGHT_SERVICE as string,
    changeOrigin: true
}));

router.use("/payments", createProxyMiddleware({
    target: PAYMENT_SERVICE as string,
    changeOrigin: true
}));

router.use("/notifications                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             ", createProxyMiddleware({
    target: NOTIFICATION_SERVICE as string,
    changeOrigin: true
}));

export default router;