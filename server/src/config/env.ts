import dotenv from 'dotenv';
import path from 'path';

// Load .env from server dir first, fallback to root .env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  APP_NAME: process.env.APP_NAME || 'TaskPulse',
  COMPANY_NAME: process.env.COMPANY_NAME || 'TaskPulse Technologies',
  DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/taskpulse',
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'taskpulse',
  JWT_SECRET: process.env.JWT_SECRET || 'dev_jwt_secret_taskpulse_2026_change_in_prod',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  COOKIE_NAME: process.env.COOKIE_NAME || 'taskpulse_token',
  COOKIE_SECURE: process.env.COOKIE_SECURE === 'true',
  COOKIE_SAME_SITE: (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') || 'lax',
  INITIAL_ADMIN_EMAIL: process.env.INITIAL_ADMIN_EMAIL || 'admin@taskpulse.com',
  INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD || 'Admin@TaskPulse2026!',
  INITIAL_ADMIN_NAME: process.env.INITIAL_ADMIN_NAME || 'System Administrator',
  INITIAL_ADMIN_EMP_ID: process.env.INITIAL_ADMIN_EMP_ID || 'EMP-0001',
  INITIAL_ADMIN_DEPT: process.env.INITIAL_ADMIN_DEPT || 'Executive',
  MAX_TASK_BACKDATE_DAYS: parseInt(process.env.MAX_TASK_BACKDATE_DAYS || '1', 10),
};
