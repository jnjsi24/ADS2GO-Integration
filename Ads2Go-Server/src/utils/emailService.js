// server/utils/emailService.js

const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  static transporter = null;
  static isConfigured = false;

  // Initialize SMTP transporter
  static initializeTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    // Check for SMTP configuration
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpSecure = process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1';

    // Debug: Check if SMTP config exists
    console.log('🔍 Checking SMTP configuration:');
    console.log('   SMTP_HOST:', smtpHost ? '✅ Found (hidden)' : '❌ Not found');
    console.log('   SMTP_PORT:', smtpPort || 'Not set (using default: 587)');
    console.log('   SMTP_USER:', smtpUser ? '✅ Found (hidden)' : '❌ Not found');
    console.log('   SMTP_PASSWORD:', smtpPassword ? '✅ Found (hidden)' : '❌ Not found');
    console.log('   SMTP_SECURE:', smtpSecure);

    // Validate required environment variables
    if (!smtpHost || !smtpUser || !smtpPassword) {
      console.error('❌ Email service not configured: Missing SMTP configuration');
      console.error('💡 Required environment variables: SMTP_HOST, SMTP_USER, SMTP_PASSWORD');
      console.error('💡 Optional: SMTP_PORT (default: 587), SMTP_SECURE (default: false)');
      this.isConfigured = false;
      return null;
    }

    try {
      // Create transporter
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort, 10),
        secure: smtpSecure, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
        // Add TLS options for better compatibility
        tls: {
          rejectUnauthorized: false, // Accept self-signed certificates (set to true in production with valid certs)
        },
      });

      this.isConfigured = true;
      console.log('✅ Email service initialized successfully with SMTP');
      console.log(`   Host: ${smtpHost}, Port: ${smtpPort}, Secure: ${smtpSecure}`);
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
      this.initializeTransporter();
    }

    if (!this.isConfigured || !this.transporter) {
      console.error('❌ Email service not configured');
      return false;
    }

    try {
      // Verify SMTP connection
      await this.transporter.verify();
      console.log('✅ Email service configuration verified (SMTP)');
      return true;
    } catch (error) {
      console.error('❌ Email service verification failed:', error.message);
      return false;
    }
  }

  // Get Resend instance directly (stub for backward compatibility)
  static getResendInstance() {
    console.warn('⚠️ getResendInstance() is deprecated - use getTransporter() instead');
    return null;
  }

  // Get transporter (nodemailer transporter)
  static getTransporter() {
    if (!this.transporter && !this.initializeTransporter()) {
      console.error('❌ EmailService: Failed to initialize SMTP transporter');
      console.error('❌ EmailService: Check SMTP_HOST, SMTP_USER, SMTP_PASSWORD environment variables');
      return null;
    }
    return this.transporter;
  }

  // Get the "from" email address (uses env var or default)
  static getFromEmail() {
    // Priority: 1. Environment variable, 2. SMTP_USER, 3. Default
    if (process.env.SMTP_FROM_EMAIL) {
      return process.env.SMTP_FROM_EMAIL;
    }
    if (process.env.SMTP_USER) {
      return `Ads2Go <${process.env.SMTP_USER}>`;
    }
    return 'Ads2Go <noreply@ads2go.com>';
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
      console.error('   Please check your .env file for SMTP configuration');
      return false;
    }

    try {
      const mailOptions = {
        from: this.getFromEmail(),
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
        `,
        text: `Ads2Go Email Verification\n\nYour verification code is: ${code}\n\nThis code will expire in 15 minutes. Do not share this code with anyone.`,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Verification email sent successfully to ${email}`);
      console.log(`   Message ID: ${info.messageId || 'N/A'}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending verification email:', error.message);
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
  
    try {
      const mailOptions = {
        from: this.getFromEmail(),
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
        `,
        text: `Reset Your Ads2Go Password\n\nClick the link below to reset your password:\n${resetLink}\n\nThis link will expire in 1 hour. If you didn't request this, please ignore this email.`,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Password reset email sent to ${email}`);
      console.log(`   Message ID: ${info.messageId || 'N/A'}`);
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

    try {
      const mailOptions = {
        from: this.getFromEmail(),
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
        `,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Newsletter welcome email sent to ${email}`);
      console.log(`   Message ID: ${info.messageId || 'N/A'}`);
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

    try {
      const emails = subscribers.map(sub => sub.email);
      
      // Send to all recipients using BCC for privacy
      const mailOptions = {
        from: this.getFromEmail(),
        to: emails[0], // First email as TO
        bcc: emails.slice(1), // Rest as BCC
        subject: subject,
        html: content,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Newsletter sent to ${subscribers.length} subscribers`);
      console.log(`   Message ID: ${info.messageId || 'N/A'}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending newsletter email:', error.message);
      return false;
    }
  }

  // Send newsletter email with image and styled template
  static async sendNewsletterEmailWithImage(subject, message, imageUrl, subscribers) {
    const transporter = this.getTransporter();
    if (!transporter) {
      console.error('❌ Cannot send email: Email service not configured');
      return false;
    }

    // Convert plain text message to HTML with line breaks
    const formattedMessage = message.replace(/\n/g, '<br>');

    // Build unsubscribe link (generic for now)
    const unsubscribeLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/unsubscribe`;

    // Build HTML email with Ads2Go style
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
        <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Ads2Go Logo/Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4A90E2; margin: 0; font-size: 32px; font-weight: bold;">Ads2Go</h1>
            <p style="color: #999; margin: 5px 0 0 0; font-size: 14px;">Digital Advertising Solutions</p>
          </div>
          
          <!-- Divider -->
          <div style="border-bottom: 2px solid #f0f0f0; margin-bottom: 30px;"></div>
          
          <!-- Image (if provided) -->
          ${imageUrl ? `
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="${imageUrl}" alt="Newsletter Image" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            </div>
          ` : ''}
          
          <!-- Message Content -->
          <div style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
            ${formattedMessage}
          </div>
          
          <!-- Footer -->
          <div style="border-top: 2px solid #f0f0f0; padding-top: 20px; margin-top: 30px;">
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} Ads2Go. All rights reserved.
            </p>
            <p style="color: #999; font-size: 12px; text-align: center; margin: 10px 0 0 0;">
              <a href="${unsubscribeLink}" style="color: #4A90E2; text-decoration: none;">Unsubscribe from this newsletter</a>
            </p>
          </div>
        </div>
      </div>
    `;

    try {
      const emails = subscribers.map(sub => sub.email);
      
      const mailOptions = {
        from: this.getFromEmail(),
        to: emails[0],
        bcc: emails.slice(1),
        subject: subject,
        html: htmlContent,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Newsletter with image sent to ${subscribers.length} subscribers`);
      console.log(`   Message ID: ${info.messageId || 'N/A'}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending newsletter email with image:', error.message);
      return false;
    }
  }

  // Send reply to contact form submission
  static async sendContactReply(toEmail, toName, subject, message, adminName) {
    console.log(`📧 Sending contact reply to: ${toEmail}`);
    
    const transporter = this.getTransporter();
    if (!transporter) {
      console.error('❌ Cannot send email: Email service not configured');
      return false;
    }

    try {
      // Get email address from formatted string or use SMTP_USER
      const fromEmail = this.getFromEmail();
      const fromEmailMatch = fromEmail.match(/<(.+)>/);
      const supportEmail = fromEmailMatch ? fromEmailMatch[1] : (process.env.SMTP_USER || 'noreply@ads2go.com');
      
      const mailOptions = {
        from: `Ads2Go Support <${supportEmail}>`,
        to: toEmail,
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
            <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #3674B5; margin: 0; font-size: 24px;">Ads2Go</h1>
                <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">Mobile Advertising Solutions</p>
              </div>
              
              <div style="margin-bottom: 20px;">
                <p style="margin: 0; color: #333; font-size: 16px;">Dear ${toName},</p>
              </div>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3674B5;">
                ${message.replace(/\n/g, '<br>')}
              </div>

              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                <p style="margin: 0; color: #666; font-size: 14px;">
                  Best regards,<br>
                  <strong style="color: #3674B5;">${adminName || 'Ads2Go Team'}</strong>
                </p>
              </div>

              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                  This email was sent in response to your inquiry at 
                  <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}" 
                     style="color: #3674B5; text-decoration: none;">Ads2Go</a>.<br>
                  If you have any questions, please reply to this email.
                </p>
              </div>
            </div>
          </div>
        `,
        text: `Dear ${toName},\n\n${message}\n\nBest regards,\n${adminName || 'Ads2Go Team'}`,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Contact reply sent successfully to ${toEmail}`);
      console.log(`   Message ID: ${info.messageId || 'N/A'}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending contact reply:', error.message);
      return false;
    }
  }
}

module.exports = EmailService;
