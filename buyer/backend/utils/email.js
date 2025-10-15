import nodemailer from 'nodemailer';

// Uncomment if you want to load env vars here, usually done in your main entry file
import dotenv from 'dotenv';
dotenv.config();

const createTransporter = () => {
  console.log('[EMAIL] Creating transporter...');
  
  const port = Number(process.env.SMTP_PORT);
  const isSecure = port === 465; // true only for port 465

  if (!process.env.SMTP_HOST || !process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
    throw new Error('[EMAIL] Missing required SMTP environment variables');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: port,
    secure: isSecure,
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
    logger:true,
    debug:true,
    // tls: { rejectUnauthorized: false }, // uncomment if TLS issues
  });

  console.log('[EMAIL] Transporter created successfully');
  return transporter;
};

export const sendEmail = async ({ email, subject, message, html }) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
    to: email,
    subject,
    text: html ? undefined : message,
    html: html || undefined,
  };

  console.log(`[EMAIL] Sending email to ${email} with subject "${subject}"...`);
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Email sent: ${info.messageId}`);
  } catch (error) {
    console.error('[EMAIL] Error sending email:', error);
    throw error; // rethrow to handle upstream if needed
  }
};

export const sendVerificationEmail = async (email, verificationToken) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
  const html = `
    <h1>Welcome to ParkFinder!</h1>
    <p>Please click the link below to verify your email address:</p>
    <a href="${verificationUrl}">${verificationUrl}</a>
    <p>This link will expire in 24 hours.</p>
  `;

  console.log(`[EMAIL] Preparing verification email for ${email}`);
  await sendEmail({ email, subject: 'Verify Your Email Address', html });
  console.log('[EMAIL] Verification email sent.');
};

export const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  const html = `
    <h1>Password Reset Request</h1>
    <p>You requested to reset your password. Click the link below to set a new password:</p>
    <a href="${resetUrl}">${resetUrl}</a>
    <p>This link will expire in 10 minutes.</p>
    <p>If you didn\'t request this, please ignore this email.</p>
  `;

  console.log(`[EMAIL] Preparing password reset email for ${email}`);
  await sendEmail({ email, subject: 'Password Reset Request', html });
  console.log('[EMAIL] Password reset email sent.');
};

export const sendNotification = async (recipientEmail, subject, message) => {
  console.log(`[EMAIL] Preparing notification email for ${recipientEmail}`);
  await sendEmail({ email: recipientEmail, subject, message });
  console.log('[EMAIL] Notification email sent.');
};




