import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import app from '@root/app';
import { ServerConfig } from "@root/config";

const HOST = process.env.HOST || '0.0.0.0';
const PORT: number = ServerConfig.PORT ? ServerConfig.PORT : 7860;

app.listen(PORT, HOST, () => {
    console.log(`✅ Server running on http://${HOST}:${PORT}`);
    console.log(`✅ Health checks: http://${HOST}:${PORT}/api/health`);
});
