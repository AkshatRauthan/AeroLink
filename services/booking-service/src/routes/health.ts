import { Router } from 'express';
import { ServerConfig } from '@root/config';
import { connectBookingCache } from "@root/infrastructure/cache"
import { connectBookingDatabases } from '@root/infrastructure/db';

const router: Router = Router();

router.get('/', (_, res) => {
    res.status(200).json({
        status: 'ok',
        service: ServerConfig.SERVICE_NAME,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

router.get('/ready', async (_, res) => {
    const checks: Record<string, { status: string; message?: string }> = {};

    try {
        await connectBookingDatabases();
        checks.database = { status: 'ok' };
    } catch (err) {
        checks.database = { status: 'error', message: err instanceof Error ? err.message : String(err) };
    }

    try {
        await connectBookingCache();
        checks.cache = { status: 'ok' };
    } catch (err) {
        checks.cache = { status: 'error', message: err instanceof Error ? err.message : String(err) };
    }

    const allOk = Object.values(checks).every((c) => c.status === 'ok');

    res.status(allOk ? 200 : 503).json({
        status: allOk ? 'ok' : 'degraded',
        service: ServerConfig.SERVICE_NAME,
        checks,
        timestamp: new Date().toISOString(),
    });
});

export default router;