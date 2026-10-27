import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { ENV } from './config/env.js';

const startServer = async () => {
  try {
    await connectDB();
    const app = createApp();

    const server = app.listen(ENV.PORT, () => {
      console.log(`===============================================`);
      console.log(`🚀 ${ENV.APP_NAME} Backend API Server`);
      console.log(`📡 URL: http://localhost:${ENV.PORT}`);
      console.log(`🌍 Default Timezone: ${ENV.DEFAULT_TIMEZONE}`);
      console.log(`⚡ Environment: ${ENV.NODE_ENV}`);
      console.log(`===============================================`);
    });

    const shutdown = async (signal: string) => {
      console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);
      server.close(() => {
        console.log('[Server] HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('[Server] Fatal startup error:', error);
    process.exit(1);
  }
};

startServer();
