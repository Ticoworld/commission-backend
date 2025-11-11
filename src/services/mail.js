const Brevo = require('@getbrevo/brevo');
const env = require('../config/env');

// Configure the Brevo API client
const defaultClient = Brevo.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = env.BREVO_API_KEY;
const apiInstance = new Brevo.TransactionalEmailsApi();

function parseSender(raw) {
  // Accept formats: "Name <email@domain>" or "email@domain"
  if (!raw) return { name: 'ESLGSC', email: 'noreply@eslgsc.gov.ng' };
  const cleaned = String(raw).trim();
  const match = cleaned.match(/^(.*)<\s*([^>]+)\s*>\s*$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, '') || 'ESLGSC';
    const email = match[2].trim();
    return { name, email };
  }
  // Otherwise assume it's an email only
  const email = cleaned.replace(/^"|"$/g, '');
  return { name: 'ESLGSC', email };
}

async function sendMail({ to, subject, text, html }) {
  // If no API key and not production, mock-send to avoid blocking dev
  if (!env.BREVO_API_KEY && env.NODE_ENV !== 'production') {
    console.warn('[mail] BREVO_API_KEY not set. Mock sending email in non-production.');
    console.log('[mail:mock]', { to, subject, text, html });
    return { mock: true };
  }
  if (!env.BREVO_API_KEY && env.NODE_ENV === 'production') {
    throw new Error('[mail] BREVO_API_KEY is required in production');
  }

  const sender = parseSender(env.EMAIL_FROM);
  const sendSmtpEmail = new Brevo.SendSmtpEmail();
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.textContent = text;
  sendSmtpEmail.sender = { name: sender.name, email: sender.email };
  sendSmtpEmail.to = [{ email: to }];

  try {
    console.log('Sending email via Brevo API...');
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Brevo API call successful. Message ID: ' + data.messageId);
    return data;
  } catch (error) {
    console.error('Error sending email with Brevo:', error);
    throw error;
  }
}

module.exports = { sendMail };