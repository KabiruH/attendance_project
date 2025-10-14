// lib/email.ts
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let transporter: Transporter;

// Initialize transporter
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Verify configuration
    transporter.verify((error: any, success: any) => {
      if (error) {
        console.error('❌ SMTP Configuration Error:', error);
      } else {
        console.log('✅ Email server is ready');
      }
    });
  }
  
  return transporter;
}

interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: EmailParams) {
  try {
    const transporter = getTransporter();
    
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to,
      subject,
      html,
      text,
    });
    
    console.log('✅ Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email send error:', error);
    return { success: false, error };
  }
}

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  name: string
): Promise<{ success: boolean; error?: any }> {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
          }
          .email-wrapper {
            background-color: #f4f4f4;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .content {
            padding: 40px 30px;
          }
          .content p {
            margin: 15px 0;
            font-size: 16px;
          }
          .button-container {
            text-align: center;
            margin: 35px 0;
          }
          .button {
            display: inline-block;
            padding: 16px 32px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
          }
          .link-box {
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            padding: 15px;
            border-radius: 6px;
            word-break: break-all;
            font-size: 13px;
            color: #495057;
            margin: 20px 0;
            font-family: monospace;
          }
          .warning-box {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px 20px;
            margin: 25px 0;
            border-radius: 4px;
          }
          .warning-box strong {
            color: #856404;
            display: block;
            margin-bottom: 10px;
          }
          .warning-box ul {
            margin: 5px 0;
            padding-left: 20px;
          }
          .warning-box li {
            margin: 5px 0;
            color: #856404;
          }
          .footer {
            background-color: #f8f9fa;
            text-align: center;
            padding: 25px 20px;
            border-top: 1px solid #e9ecef;
          }
          .footer p {
            margin: 5px 0;
            font-size: 12px;
            color: #6c757d;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset Request</h1>
            </div>
            
            <div class="content">
              <p>Hello <strong>${name}</strong>,</p>
              
              <p>We received a request to reset your password for your attendance account. Click the button below to create a new password:</p>
              
              <div class="button-container">
                <a href="${resetUrl}" class="button">Reset Your Password</a>
              </div>
              
              <p style="font-size: 14px; color: #6c757d;">If the button doesn't work, copy and paste this link into your browser:</p>
              <div class="link-box">${resetUrl}</div>
              
              <div class="warning-box">
                <strong>⚠️ Important Security Information:</strong>
                <ul>
                  <li>This link will expire in <strong>1 hour</strong></li>
                  <li>If you didn't request this reset, please ignore this email</li>
                  <li>Your password will remain unchanged until you complete the reset</li>
                  <li>Never share this link with anyone</li>
                </ul>
              </div>
              
              <p>If you have any questions or concerns, please contact our support team.</p>
              
              <p style="margin-top: 30px;">
                Best regards,<br>
                <strong>The Attendance Team</strong>
              </p>
            </div>
            
            <div class="footer">
              <p><strong>This is an automated email. Please do not reply to this message.</strong></p>
              <p>© ${new Date().getFullYear()} Optimum Computer Services. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
  
  const text = `
Hello ${name},

We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

⚠️ IMPORTANT:
- This link expires in 1 hour
- If you didn't request this, ignore this email
- Your password won't change until you complete the reset
- Never share this link with anyone

Best regards,
The Attendance Team

---
This is an automated email. Please do not reply.
© ${new Date().getFullYear()} Optimum Computer Services
  `;
  
  return await sendEmail({
    to: email,
    subject: '🔐 Password Reset Request - Attendance System',
    html,
    text,
  });
}

// Test email function
export async function testEmailConnection(): Promise<boolean> {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log('✅ Email connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Email connection test failed:', error);
    return false;
  }
}