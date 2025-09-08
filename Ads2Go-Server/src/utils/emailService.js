// server/utils/emailService.js

const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  static transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  // Generate 6-digit verification code
  static generateVerificationCode() {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`[EMAIL_DEBUG] Generated verification code: ${code}`);
    return code;
  }

  // Send verification email
  static async sendVerificationEmail(email, code) {
    if (!email || !code) {
      console.error('Missing email or verification code');
      return false;
    }
    
    // Log the verification code for debugging
    console.log(`[EMAIL_DEBUG] Sending verification code ${code} to ${email}`);

    console.log(`Preparing to send verification email to: ${email}`);
    
    const mailOptions = {
      from: `Ads2Go <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Ads2Go Email Verification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; text-align: center;">Ads2Go Email Verification</h2>
            <p style="text-align: center; font-size: 16px; color: #666;">Your verification code is:</p>
            <h1 style="
              text-align: center; 
              letter-spacing: 10px; 
              color: #4A90E2; 
              background-color: #f0f0f0; 
              padding: 15px; 
              border-radius: 5px;
              margin: 20px 0;
            ">
              ${code}
            </h1>
            <p style="text-align: center; color: #999; margin-top: 20px;">
              This code will expire in 15 minutes. Do not share this code with anyone.
            </p>
            <p style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
              If you didn't request this email, please ignore it.
            </p>
          </div>
        </div>
      `
    };

    try {
      // Verify connection configuration
      await this.transporter.verify(function(error, success) {
        if (error) {
          console.error('SMTP Connection Error:', error);
        } else {
          console.log('Server is ready to take our messages');
        }
      });

      // Send the email
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Message sent: %s', info.messageId);
      console.log(`Verification email successfully sent to ${email}`);
      return true;
    } catch (error) {
      console.error('Error sending verification email to', email, 'Error:', error);
      console.error('Error details:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        responseMessage: error.responseMessage
      });
      return false;
    }
  }

  // Send password reset email
  static async sendPasswordResetEmail(email, resetToken) {
    const resetLink = `http://localhost:4000/reset-password?token=${resetToken}`;
  
    const mailOptions = {
      from: `Ads2Go <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Reset Your Ads2Go Password',
      html: `
        <h1>Password Reset Request</h1>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    };

    return this.transporter.sendMail(mailOptions);
  }
}

module.exports = EmailService;
