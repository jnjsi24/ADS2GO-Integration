// server/utils/emailService.js

const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  static transporter = null;
  static isConfigured = false;

  // Initialize transporter with proper configuration
  static initializeTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    // Validate required environment variables
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error('❌ Email service not configured: Missing EMAIL_USER or EMAIL_PASSWORD');
      this.isConfigured = false;
      return null;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        },
        // Additional Gmail-specific options
        tls: {
          rejectUnauthorized: false
        }
      });

      this.isConfigured = true;
      console.log('✅ Email service initialized successfully');
      return this.transporter;
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error.message);
      this.isConfigured = false;
      return null;
    }
  }

  // Verify email configuration
  static async verifyConfiguration() {
    if (!this.isConfigured) {
      console.error('❌ Email service not configured');
      return false;
    }

    try {
      const transporter = this.initializeTransporter();
      if (!transporter) {
        return false;
      }

      await transporter.verify();
      console.log('✅ Email service configuration verified');
      return true;
    } catch (error) {
      console.error('❌ Email service verification failed:', error.message);
      
      // Provide helpful error messages
      if (error.message.includes('Invalid login') || error.message.includes('535-5.7.8')) {
        console.error('💡 Gmail authentication failed. Please check:');
        console.error('   1. Enable 2-Factor Authentication on your Gmail account');
        console.error('   2. Generate an App Password (not your regular password)');
        console.error('   3. Use the App Password as EMAIL_PASSWORD in your .env file');
        console.error('   📖 Guide: https://support.google.com/accounts/answer/185833');
      }
      
      return false;
    }
  }

  // Get transporter instance
  static getTransporter() {
    return this.initializeTransporter();
  }

  // Generate 6-digit verification code
  static generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Send verification email
  static async sendVerificationEmail(email, code) {
    console.log(`📧 Attempting to send verification email to: ${email}`);
    
    const transporter = this.getTransporter();
    if (!transporter) {
      console.error('❌ Cannot send email: Email service not configured');
      console.error('   Please check your .env file for EMAIL_USER and EMAIL_PASSWORD');
      console.error('   Run: node verify-gmail-setup.js to test email configuration');
      return false;
    }

    // Verify configuration before sending
    const isConfigured = await this.verifyConfiguration();
    if (!isConfigured) {
      console.error('❌ Cannot send email: Email service configuration verification failed');
      return false;
    }

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
            ">
              ${code}
            </h1>
            <p style="text-align: center; color: #999; margin-top: 20px;">
              This code will expire in 15 minutes. Do not share this code with anyone.
            </p>
          </div>
        </div>
      `
    };

    try {
      const result = await transporter.sendMail(mailOptions);
      console.log(`✅ Verification email sent successfully to ${email}`);
      console.log(`   Message ID: ${result.messageId}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending verification email:', error.message);
      
      // Provide specific error guidance
      if (error.message.includes('535-5.7.8') || error.message.includes('Invalid login')) {
        console.error('💡 Gmail authentication failed. Please check:');
        console.error('   1. Enable 2-Factor Authentication on your Gmail account');
        console.error('   2. Generate an App Password (not your regular password)');
        console.error('   3. Use the App Password as EMAIL_PASSWORD in your .env file');
        console.error('   📖 Guide: GMAIL_SETUP_GUIDE.md');
        console.error('   🔧 Test: node verify-gmail-setup.js');
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        console.error('💡 Network connection failed. Please check:');
        console.error('   1. Internet connection');
        console.error('   2. Firewall settings');
        console.error('   3. SMTP server settings');
      }
      
      return false;
    }
  }

  // Send password reset email
  static async sendPasswordResetEmail(email, resetToken) {
    const transporter = this.getTransporter();
    if (!transporter) {
      console.error('❌ Cannot send email: Email service not configured');
      return false;
    }

    const resetLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
  
    const mailOptions = {
      from: `Ads2Go <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Reset Your Ads2Go Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
            <p style="text-align: center; font-size: 16px; color: #666;">Click the button below to reset your password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" 
                 style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #666; text-align: center; margin: 20px 0;">
              This link will expire in 1 hour. If you didn't request this, please ignore this email.
            </p>
          </div>
        </div>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Password reset email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending password reset email:', error.message);
      return false;
    }
  }

  // Send newsletter welcome email
  static async sendNewsletterWelcomeEmail(email, subject = 'Welcome to Ads2Go Newsletter!') {
    const transporter = this.getTransporter();
    if (!transporter) {
      console.error('❌ Cannot send email: Email service not configured');
      return false;
    }

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
      await transporter.sendMail(mailOptions);
      console.log(`✅ Newsletter welcome email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending newsletter welcome email:', error.message);
      return false;
    }
  }

  // Send newsletter email to all subscribers
  static async sendNewsletterEmail(subject, content, subscribers) {
    const transporter = this.getTransporter();
    if (!transporter) {
      console.error('❌ Cannot send email: Email service not configured');
      return false;
    }

    const mailOptions = {
      from: `Ads2Go <${process.env.EMAIL_USER}>`,
      bcc: subscribers.map(sub => sub.email).join(','),
      subject: subject,
      html: content
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Newsletter sent to ${subscribers.length} subscribers`);
      return true;
    } catch (error) {
      console.error('❌ Error sending newsletter email:', error.message);
      return false;
    }
  }
}

module.exports = EmailService;
