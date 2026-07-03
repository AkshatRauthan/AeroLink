import app from './app';
import { connectDB, ServerConfig } from "@root/config";

const HOST = process.env.HOST || '0.0.0.0';
const PORT: number = ServerConfig.PORT ? parseInt(ServerConfig.PORT, 10) : 7860;

app.listen(PORT, HOST, () => {
    console.log(`✅ Server running on http://${HOST}:${PORT}`);
    console.log(`✅ Health checks: http://${HOST}:${PORT}/api/health`);
});

connectDB()
    .then(() => {
        console.log('✅ Database connected');
    })
    .catch((error: unknown) => {
        console.error('Failed to connect to the database:', error);
        console.warn('Server started in degraded mode — /health reports database: disconnected');
    });