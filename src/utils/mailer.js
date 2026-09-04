const nodemailer = require('nodemailer');

const gmailUser = (process.env.GMAIL_USER || '').trim();
const gmailAppPassword = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

function isMailConfigured() {
  return Boolean(gmailUser && gmailAppPassword);
}

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailAppPassword
    }
  });
}

async function sendPasswordResetEmail({ to, name, token, isAdmin = false }) {
  if (!isMailConfigured()) {
    const error = new Error('Password reset email is not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to the production environment.');
    error.publicMessage = 'Password reset email is temporarily unavailable. Please contact support.';
    error.status = 503;
    throw error;
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost/itresolve-backend/index.php';
  const resetUrlObject = new URL(frontendUrl);
  resetUrlObject.searchParams.set('reset', isAdmin ? 'admin' : 'user');
  resetUrlObject.searchParams.set('token', token);
  const resetUrl = resetUrlObject.toString();
  const transporter = createTransporter();

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.GMAIL_USER,
    to,
    subject: 'ITResolve password reset',
    text: `Hello ${name || 'there'},\n\nUse this link to reset your ITResolve password:\n${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, you can ignore this email.`,
    html: `<p>Hello ${name || 'there'},</p><p>Use the link below to reset your ITResolve password. It expires in 1 hour.</p><p><a href="${resetUrl}">Reset your password</a></p><p>If you did not request this, you can ignore this email.</p>`
  });

  return true;
}

module.exports = { isMailConfigured, sendPasswordResetEmail };
