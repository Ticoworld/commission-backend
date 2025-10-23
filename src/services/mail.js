const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter;
function getTransporter() {
  if (!transporter) {
    if (!env.SMTP_HOST) {
      if (env.NODE_ENV === 'production') {
        throw new Error('[mail] SMTP not configured in production');
      } else {
        console.warn('[mail] SMTP not configured. Emails will be logged to console.');
        transporter = null;
      }
    } else {
      transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      });
    }
  }
  return transporter;
}

async function sendMail({ to, subject, text, html, attachments }) {
  const t = getTransporter();
  if (!t) {
    console.log('[mail:mock]', { to, subject, text, html });
    return { mock: true };
  }
  return t.sendMail({ from: env.EMAIL_FROM, to, subject, text, html, attachments });
}

module.exports = { sendMail };