import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

console.log('Loaded SMTP env variables:');
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_PORT:', process.env.SMTP_PORT);
console.log('SMTP_EMAIL:', process.env.SMTP_EMAIL ? '[present]' : '[MISSING]');
console.log('SMTP_PASSWORD:', process.env.SMTP_PASSWORD ? '[present]' : '[MISSING]');
console.log('FROM_EMAIL:', process.env.FROM_EMAIL);
console.log('FROM_NAME:', process.env.FROM_NAME);

async function testEmail() {
  // Basic env validation
  const required = ['SMTP_HOST','SMTP_PORT','SMTP_EMAIL','SMTP_PASSWORD','FROM_EMAIL'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    throw new Error('Missing required env vars: ' + missing.join(', '));
  }

  console.log('[EMAIL] Creating transporter...');

  const portNum = Number(process.env.SMTP_PORT);
  const secure = portNum === 465;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: portNum,
    secure, // true for 465, false for other ports (STARTTLS)
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD, // must be Brevo SMTP key / API key
    },
    // Optional: force STARTTLS on 587
    requireTLS: !secure,
    // Optional TLS fallback (use only for debugging; avoid in production unless necessary)
    tls: {
      // rejectUnauthorized: false // uncomment only for debugging cert issues (not recommended)
    },
    logger: true, // enable logging (console) for nodemailer internals
    debug: true   // include SMTP traffic in logs
  });

  console.log('[EMAIL] Verifying transporter (will attempt to connect/authenticate)...');
  // verify() will attempt connection and authentication early and give clearer error context
  await transporter.verify();
  console.log('[EMAIL] Transporter verified (connection & auth succeeded)');

  const info = await transporter.sendMail({
    from: `"${process.env.FROM_NAME || ''}" <${process.env.FROM_EMAIL}>`,
    to: process.env.TEST_TO_EMAIL || "lakshrajkumar.791.lrk@gmail.com",
    subject: 'Test email from Brevo SMTP',
    text: 'Hello! This is a test email sent using Brevo SMTP.',
  });

  console.log('Message sent:', info.messageId, info.response);
}

testEmail()
  .then(() => console.log('[EMAIL] Test email sent successfully'))
  .catch(err => {
    console.error('[EMAIL] Failed to send test email:');
    // Print helpful properties if present
    console.error('name:', err?.name);
    console.error('code:', err?.code);
    console.error('responseCode:', err?.responseCode);
    console.error('response:', err?.response);
    console.error(err);
  });
