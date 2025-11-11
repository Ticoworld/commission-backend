const SibApiV3Sdk = require('sib-api-v3-sdk');
const { EMAIL_FROM, BREVO_API_KEY, NODE_ENV } = require('../config/env');

// Configure the API client
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendMail({ to, subject, text, html }) {
  if (!BREVO_API_KEY) {
    if (NODE_ENV === 'production') {
      throw new Error('[mail] BREVO_API_KEY is required in production');
    }
    console.warn('[mail] BREVO_API_KEY not set. Mock email logged.');
    console.log('[mail:mock]', { to, subject, text, html });
    return { mock: true };
  }

  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.textContent = text;
  sendSmtpEmail.sender = { name: 'ESLGSC', email: EMAIL_FROM };
  sendSmtpEmail.to = [{ email: to }];

  try {
    console.log('Sending email via Brevo API (sib-api-v3-sdk)...');
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Brevo API call successful. Message ID:', data?.messageId || data);
    return data;
  } catch (error) {
    console.error('Error sending email with Brevo:', error?.response?.text || error.message || error);
    throw error;
  }
}

module.exports = { sendMail };