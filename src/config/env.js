const dotenv = require('dotenv');
dotenv.config();

const required = ['DATABASE_URL', 'JWT_SECRET', 'UPLOAD_DIR', 'EMAIL_FROM'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.warn(`[env] Missing required env keys: ${missing.join(', ')}`);
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'changeme',
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM || 'ESLGSC <noreply@eslgsc.gov.ng>',
  // Frontend base URL for links in emails (invite/reset). Defaults to Vite dev server in development.
  APP_BASE_URL: process.env.APP_BASE_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : undefined),
};

module.exports = env;