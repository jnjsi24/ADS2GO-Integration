// server/utils/emailService.js

const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  static transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
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

  // Send newsletter welcome email
  static async sendNewsletterWelcomeEmail(email, subject = 'Welcome to Ads2Go Newsletter!') {
    const mailOptions = {
      from: `Ads2Go <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #3674B5; margin: 0; font-size: 28px;">Welcome to Ads2Go!</h1>
              <p style="color: #666; margin: 10px 0 0 0; font-size: 16px;">Your mobile advertising journey starts here</p>
            </div>
            
            <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3674B5;">
              <h3 style="color: #3674B5; margin: 0 0 15px 0;">🎉 Thank you for subscribing!</h3>
              <p style="margin: 0; color: #333; line-height: 1.6;">
                You're now part of our community and will receive the latest updates about:
              </p>
              <ul style="margin: 15px 0 0 20px; color: #333;">
                <li>New features and platform updates</li>
                <li>Industry insights and mobile advertising trends</li>
                <li>Exclusive promotions and special offers</li>
                <li>Success stories from our clients</li>
                <li>Tips for maximizing your advertising ROI</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/login" 
                 style="background-color: #3674B5; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                Get Started with Ads2Go
              </a>
            </div>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h4 style="color: #333; margin: 0 0 10px 0;">What's Next?</h4>
              <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.5;">
                • Create your account to start advertising<br>
                • Choose from our vehicle plans (Motorcycle, Car, Bus, Jeepney)<br>
                • Upload your ad content and launch your campaign<br>
                • Track performance with real-time analytics
              </p>
            </div>

            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                You received this email because you subscribed to our newsletter at Ads2Go.<br>
                If you no longer wish to receive these emails, you can 
                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/unsubscribe?email=${email}" 
                   style="color: #3674B5; text-decoration: none;">unsubscribe here</a>.
              </p>
            </div>
          </div>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Newsletter welcome email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('Error sending newsletter welcome email:', error);
      return false;
    }
  }

  // Send newsletter email to all subscribers
  static async sendNewsletterEmail(subject, content, subscribers) {
    const mailOptions = {
      from: `Ads2Go <${process.env.EMAIL_USER}>`,
      bcc: subscribers.map(sub => sub.email).join(','),
      subject: subject,
      html: content
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Newsletter sent to ${subscribers.length} subscribers`);
      return true;
    } catch (error) {
      console.error('Error sending newsletter email:', error);
      return false;
    }
  }
}

module.exports = EmailService;
